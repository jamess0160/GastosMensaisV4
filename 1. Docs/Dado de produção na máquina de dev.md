# Dado de produção na máquina de dev

**Este documento é o caminho de volta.** O [Deploy.md](Deploy.md) leva código desta máquina para
o servidor; este traz **dado** do servidor para cá, para testar contra o banco de verdade — e
cobre também rodar SQL à mão no banco, dos dois lados.

Ele existe porque o runbook descreve a **máquina de produção**, e quase nada do que está aqui
acontece lá. A divisão vale entender antes de copiar comando:

| Documento | O que cobre |
| --- | --- |
| [Deploy.md](Deploy.md) | O **servidor**: subir, atualizar, migrar, ler log, restaurar o backup em produção, abrir o DBeaver. É lido num incidente |
| **Este** | A **sua máquina**: descer um dump de produção, restaurar aqui, e rodar SQL no banco local. Nada daqui é um incidente |

Onde este documento manda você para o `Deploy.md`, **vá e volte**.

## As duas máquinas não têm o mesmo banco

Esta tabela é o item que mais confunde, e errá-la custa uma hora de "o restore funcionou e a API
não vê o dado":

| | Produção | Esta máquina |
| --- | --- | --- |
| Host e porta | `127.0.0.1:5432`, preso à loopback da VPS | `localhost:5441` |
| Usuário | o `DB_LOGIN` do `.env` da **raiz do clone** | `postgres` |
| Banco | o `DB_SCHEMA` do mesmo arquivo | `gastos_mensais_v4` |
| Quem o sobe | o serviço `db` do [`docker-compose.yml`](../docker-compose.yml) | um container de dev, **fora** do compose |
| Onde a API lê isso | `env_file: .env`, na raiz | [`API/.env`](../API/.env) |

**Um `docker compose up` nesta máquina não sobe o seu banco de desenvolvimento — sobe um
segundo Postgres, na 5432, vazio.** A API local continua lendo a 5441, porque é o que está no
`API/.env`. Os dois conviver na mesma máquina é normal; confundi-los é que não é, e o sintoma é
restaurar o dump num e procurar o dado no outro.

---

## 1. Trazer o dump para cá

### 1.1 Tire um dump novo — não use os de `/var/backups`

Os dumps do timer vivem em `/var/backups/gastosmensais/`, que é `0700 root:root`. `scp` direto
naquele caminho responde `Permission denied`, e **a saída óbvia corrompe o arquivo em silêncio**:

```bash
ssh -t tiago@<ip da vps> 'sudo cat /var/backups/...' > dump    # NÃO
```

O `-t` aloca um pty, e o pty traduz `\n` em `\r\n` no meio de um binário. O `scp` não reclama, o
arquivo tem tamanho plausível, e quem descobre é o `pg_restore` aqui, horas depois, com um erro
que parece ser do seu Postgres local.

Tire um dump novo no seu próprio `home`. É o mesmo comando do [`deploy/backup.sh`](../deploy/backup.sh)
e **não precisa de `sudo`** — o usuário `tiago` está no grupo `docker`:

```bash
ssh tiago@<ip da vps>
cd /opt/gastosmensais
docker compose exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/gastos-$(date +%F).dump
docker compose exec -T db pg_restore --list < ~/gastos-*.dump | head   # prova que o arquivo está inteiro
ls -lh ~/gastos-*.dump
```

**O `pg_dump` só lê, e não trava escrita.** Ele tira um snapshot consistente de dentro de uma
transação: não é preciso parar a API, e o usuário no celular não percebe. Esta é a diferença
entre este procedimento e o [5.3 do Deploy.md](Deploy.md#53-o-banco-inteiro--o-caso-do-desastre),
que **derruba** a API de propósito porque *escreve* no banco de produção.

O `-Fc` (formato custom) é o mesmo do backup: comprimido, indexado, e é o que permite restaurar
uma tabela só se um dia for preciso.

### 1.2 Desça com `scp`, nunca por pipe do PowerShell

Do PowerShell desta máquina:

```powershell
scp tiago@<ip da vps>:~/gastos-2026-10-05.dump C:\Users\tiago\Downloads\
ssh tiago@<ip da vps> 'rm ~/gastos-*.dump'
```

**O PowerShell 5.1 não sabe mover binário**, e são duas falhas diferentes:

- **`<` não existe.** É erro de parser (`The '<' operator is reserved for future use`) — esta
  falha, ao menos, é barulhenta;
- **`>` re-encoda a saída como texto.** Esta é silenciosa: o arquivo sai gravado com outra
  codificação, do tamanho errado, e o `pg_restore` só diz que o cabeçalho é inválido.

O `scp` escreve o arquivo ele mesmo, byte a byte, sem passar pelo shell. Quando precisar de pipe
de verdade, use o Git Bash — não o PowerShell.

### 1.3 O arquivo é o banco inteiro em claro

E-mails reais, hashes de senha, tudo. Duas consequências práticas:

- **Fora do clone.** O [`.gitignore`](../.gitignore) da raiz **não** ignora `*.dump`: um arquivo
  desses dentro do repositório entra no próximo `git add .` sem ninguém notar, e segredo
  commitado não deixa de estar commitado quando o commit seguinte o apaga. `Downloads` serve;
- **Apague os dois**, o do `home` do servidor (o `rm` acima) e o seu, quando o teste acabar. O
  `/var/backups` ser `0700` é exatamente esse cuidado, do outro lado.

---

## 2. Restaurar no banco local

Descubra o container do Postgres de dev (`docker ps`) e leve o arquivo **para dentro dele** com
`docker cp` — de novo, para não haver redirecionamento binário no PowerShell:

```powershell
docker cp C:\Users\tiago\Downloads\gastos-2026-10-05.dump <container>:/tmp/g.dump
docker exec <container> dropdb -U postgres --if-exists gastos_mensais_v4
docker exec <container> createdb -U postgres gastos_mensais_v4
docker exec <container> pg_restore -U postgres -d gastos_mensais_v4 --no-owner --no-privileges /tmp/g.dump
docker exec <container> rm /tmp/g.dump
```

Se o banco da 5441 for um Postgres nativo do Windows, é o mesmo comando sem o Docker:

```powershell
pg_restore -h localhost -p 5441 -U postgres -d gastos_mensais_v4 --no-owner --no-privileges C:\Users\tiago\Downloads\gastos-2026-10-05.dump
```

Três detalhes que são o conteúdo desta seção:

- **`dropdb`/`createdb` em vez de `--clean`.** O `--clean` num banco cujo esquema já divergiu do
  dump deixa resto para trás — tabela que não existe mais no dump, coluna que mudou de tipo — e
  resto de esquema não aparece como erro de restore, aparece como bug da aplicação dias depois;
- **`--no-owner --no-privileges` é obrigatório aqui**, e é a diferença em relação ao
  [5.1 do Deploy.md](Deploy.md#51-ensaio-geral-num-banco-descartável): o dump carrega o
  `DB_LOGIN` de produção como dono de tudo, e nesta máquina o dono é `postgres`. Sem as duas
  flags o `pg_restore` termina com uma enxurrada de avisos de `ALTER OWNER` que não são o seu
  problema — e que escondem os avisos que seriam;
- **a versão do Postgres local tem de ser ≥ a do servidor** (`postgres:17-alpine`). Um
  `pg_restore` mais antigo recusa o arquivo pelo cabeçalho, e não há flag que force: a saída é
  subir o local.

### 2.1 Rode as migrations depois. Sempre

```powershell
cd API; npm run migrate
```

**O dump é do esquema do dia em que saiu, e o seu código local está quase sempre à frente dele.**
É a mesma nota do [procedimento 3](Deploy.md#3-migration-e-rollback), pela mesma razão. Esquecer
isto dá erro de coluna inexistente no primeiro request — que ao menos é barulhento.

O script local é o `migrate`, não o `migrate:prod`: aqui existe o `knexfile.ts`, que **não existe
dentro da imagem** de produção. É a pegadinha do procedimento 3 vista do outro lado.

---

## 3. O que não funciona com dado de produção aqui

- **A biometria não autentica.** As credenciais WebAuthn estão presas ao `RP ID`, que é o domínio
  de produção; em `localhost` elas existem na tabela e são inúteis. Entre por **senha** — o hash
  bcrypt é o mesmo, então a sua senha de produção funciona aqui;
- **confira que o `API/.env` não tem `NODE_ENV=production`** antes de subir a API contra dado
  real. Fora de produção o Mailer usa `jsonTransport` e nada sai pela rede; com a variável
  ligada, a sua máquina manda e-mail **de verdade** para usuário **de verdade** — e é o único
  estrago desta página que não se desfaz apagando um banco;
- **`Balance` e `Spent` se conferem na tela, não no banco.** Não há coluna para eles: a API
  calcula a cada leitura. Se um número parecer errado depois do restore, o suspeito é a migration
  que faltou rodar, não o dump.

---

## 4. Rodar SQL no banco pelo Docker

### 4.1 O comando

Vale igual nas duas máquinas; o que muda é o container e o usuário. Em produção, a partir da raiz
do clone:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

**Esse é o caminho do incidente** — não depende de mais nada estar de pé, e é o que está nos
procedimentos [3](Deploy.md#3-migration-e-rollback) e [5](Deploy.md#5-restaurar-o-backup) do
runbook. Para olhar dado fora de um incidente, o caminho é o DBeaver pelo túnel SSH, com o
usuário só-leitura, no [procedimento 7](Deploy.md#7-abrir-o-banco-no-dbeaver).

### 4.2 Um `UPDATE` se escreve em arquivo, não na sessão interativa

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction' < correcao.sql
```

Por que o arquivo, e não digitar no `psql`:

- **`--single-transaction` com `ON_ERROR_STOP=1`**: qualquer erro no meio desfaz tudo. Digitado
  linha a linha, cada comando é a própria transação, e um erro na terceira linha deixa as duas
  primeiras aplicadas;
- **o arquivo é relido antes de rodar**, e é onde cabe o `SELECT` de conferência: deixe na
  primeira linha um `select count(*)` com **o mesmo `WHERE`** do `UPDATE`. Conferir a contagem é
  o que substitui o "achei que era uma linha só";
- **ele não passa pelo inferno de aspas** de `sh -c` dentro de PowerShell. Todo identificador
  deste banco é `"PascalCase"` entre aspas duplas, e escapá-las dentro de uma string de shell
  dentro de outra é como se grava `"Expenses"` como `Expenses` e se descobre depois.

No servidor, **force um backup antes** — leva segundos, e é o que torna o
[procedimento 5](Deploy.md#5-restaurar-o-backup) possível:

```bash
sudo systemctl start gastosmensais-backup && sudo ls -lt /var/backups/gastosmensais/ | head -3
```

### 4.3 As três regras que fazem um `UPDATE` errado passar em silêncio

Nenhuma delas dá erro. Todas dão número errado na tela, que é pior:

- **`Balance` e `Spent` não existem no banco** — a API os calcula a cada leitura. Uma linha
  errada em `ExpensePayments` não estoura: dá um **saldo plausível**, que é a pior falha que este
  app tem;
- **rateio fecha na soma, em centavos.** Mexeu no valor de uma perna ou de um `ExpensePerson`?
  Os irmãos daquele gasto precisam fechar com o total — os **dois eixos**, cada um fechando
  sozinho, nunca cruzados;
- **`CompetenceDate` e `CashDate` discordam de propósito.** Fora de um cartão em modo `purchase`
  as duas são iguais, e é justamente por isso que trocar uma pela outra só aparece meses depois,
  quando alguém abre um mês antigo.

### 4.4 `UPDATE` à mão ou migration?

**Se a correção precisa valer também na sua máquina, ou em qualquer banco que subir depois, ela
não é um `psql` à mão — é uma migration.** O `CLAUDE.md` da raiz é explícito em ajustar o banco
junto com o código que o lê, e um `UPDATE` manual em produção é divergência silenciosa entre os
dois bancos: o seu passa nos testes, o do servidor não.

`psql` à mão é para o caso pontual, que não se repete: um dado de um usuário, uma linha que
nasceu torta antes de a validação existir.
