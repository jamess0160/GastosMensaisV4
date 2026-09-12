# Deploy — o runbook

**Este documento não descreve o projeto, descreve a máquina.** Ele é o único do repositório
escrito para ser lido às duas da manhã, com o app fora do ar: seis procedimentos, cada um uma
sequência de comandos que se copia e cola, na ordem.

O **porquê** de cada decisão não está aqui — está nos comentários dos arquivos que os comandos
tocam (`docker-compose.yml`, `API/Dockerfile`, `Frontend/deploy/nginx.conf`,
`deploy/proxy/nginx.conf`, `deploy/backup.sh`) e no plano da
[leva 8](Levas/8.%20O%20que%20só%20se%20prova%20subindo.md). Se um comando daqui parecer errado, a
explicação está lá; não a improvise no meio de um incidente.

> **Máquina nova, do zero?** Este documento começa com o repositório já clonado e o Docker já
> instalado. Antes dele vem [Começando do zero](Começando%20do%20zero.md), que cobre a VPS crua:
> usuário, SSH, firewall, Docker, git, Cloudflare e certificado.

| Procedimento | Quando |
| --- | --- |
| [1. Subir pela primeira vez](#1-subir-pela-primeira-vez) | Máquina já preparada, no dia do primeiro deploy |
| [2. Atualizar](#2-atualizar) | Todo deploy depois do primeiro |
| [3. Migration e rollback](#3-migration-e-rollback) | Sempre que o `git pull` trouxe arquivo em `API/migrations/` |
| [4. Ver o log](#4-ver-o-log) | "Deu erro e não sei o quê" |
| [5. Restaurar o backup](#5-restaurar-o-backup) | Migration ruim, `delete` errado, banco perdido |
| [6. A lista de fumaça](#6-a-lista-de-fumaça) | Depois de todo deploy grande, não só do primeiro |

## Onde cada coisa mora

| O quê | Onde | Versionado? |
| --- | --- | --- |
| O clone do repositório | `/opt/gastosmensais` | — |
| A orquestração | `docker-compose.yml`, na raiz do clone | sim |
| As variáveis de ambiente | `.env`, **na raiz do clone** | **não** (`/.env` no `.gitignore`) |
| O banco | volume Docker nomeado `pgdata` | não — **é o produto** |
| O nginx de borda | container `proxy`, de `deploy/proxy/nginx.conf` | **sim** — não há mais cópia à mão em `/etc/nginx` |
| O certificado de origem | `/etc/ssl/cloudflare/`, montado `:ro` no `proxy` | não, e nunca |
| Os dumps | `/var/backups/gastosmensais/` | não |
| O agendamento do backup | `/etc/systemd/system/gastosmensais-backup.{service,timer}` | só o exemplo, em `deploy/` |
| O log da aplicação | o stdout do container — ver o [procedimento 4](#4-ver-o-log) | não existe em disco |

**Todo `docker compose` deste documento roda a partir da raiz do clone.** É lá que estão o
`docker-compose.yml` e o `.env` que ele interpola; de qualquer outro diretório os comandos falham
ou, pior, sobem um projeto vazio com outro nome.

---

## 1. Subir pela primeira vez

### 1.1 O que a máquina precisa ter

```bash
docker --version           # Engine 20.10+
docker compose version     # v2 — é "docker compose", com espaço, não "docker-compose"
git --version
openssl version
```

E o grupo `docker`, que é o pré-requisito que não aparece em nenhuma versão:

```bash
id -nG | tr ' ' '
' | grep docker    # sem isto, todo comando abaixo responde permission denied
```

**Se ele não imprimir nada**, pare aqui: `sudo usermod -aG docker $USER`, saia do SSH e entre de
novo. Prefixar tudo com `sudo` funciona e deixa metade dos comandos rodando como `root` e metade
não — o que só dá problema três passos adiante.

### 1.2 O clone

```bash
sudo install -d -o "$USER" -g "$USER" /opt/gastosmensais
git clone <url do repositório> /opt/gastosmensais
cd /opt/gastosmensais
```

O caminho `/opt/gastosmensais` não é decorativo: ele está escrito no
`deploy/gastosmensais-backup.service`. Clonar em outro lugar significa editar aquele arquivo
antes de instalá-lo (passo [1.8](#18-o-backup-só-no-servidor)).

### 1.3 O `.env` da raiz

**Crie o arquivo na raiz do clone, ao lado do `docker-compose.yml`.** Ele não é o `API/.env`: o
serviço `api` lê `env_file: .env` da raiz, e o serviço `db` tira dele o usuário e a senha que o
`initdb` cria. Um `API/.env` no servidor não é lido por ninguém.

Gere os dois segredos primeiro, e cole a saída no arquivo:

```bash
openssl rand -base64 48    # JWT_SECRET
openssl rand -hex 32       # DB_PASSWORD
```

**`-hex` na senha do banco, e não `-base64`, de propósito.** O compose interpola o `.env` antes
de montar o ambiente, e um `$` no meio do valor vira uma variável vazia — a senha que o `initdb`
grava deixa de ser a senha que o Knex manda, e o erro que aparece é
`password authentication failed`, três passos adiante. Hexadecimal não tem `$`, `"` nem `\`.

O arquivo, inteiro. **Não há mais nada para preencher, e nada aqui é opcional** (fora as duas
linhas comentadas no fim):

```bash
# --- a API ---
PORT=4000

# --- o banco ---
# DB_LOGIN, DB_PASSWORD e DB_SCHEMA são TAMBÉM o POSTGRES_USER/PASSWORD/DB do serviço `db`:
# o compose interpola as três daqui, e é o que impede o usuário que o initdb cria de divergir
# do usuário com que a API se conecta.
DB_CLIENT=pg
DB_HOST=db
DB_LOGIN=gastosmensais
DB_PASSWORD=<a saída do openssl rand -hex 32>
DB_SCHEMA=gastosmensais

# --- a sessão ---
# Um segredo NOVO, gerado no servidor. Nunca o de desenvolvimento: o token é assinado com ele,
# e um segredo compartilhado entre as duas máquinas faz um token de dev valer em produção.
JWT_SECRET=<a saída do openssl rand -base64 48>

# --- a biometria ---
# RP_ID é o domínio NU (sem esquema, sem porta) e fica no apex: uma passkey do apex vale no www,
# o contrário não. Errar qualquer um dos dois NÃO dá erro — a biometria só não funciona, e quem
# cadastrou a digital descobre na hora de usar.
#
# ORIGIN é a origem EXATA, e a comparação é literal: um www a mais ou a menos é outra origem, e
# o erro aparece no cadastro como `Unexpected registration response origin`. Ela combina com o
# APP_URL e com o server_name do app em `deploy/proxy/nginx.conf` — os três dizem o CANÔNICO, que
# é o www. O apex responde, e responde com um 301 para cá.
WEBAUTHN_RP_ID=gastosmensais.com.br
WEBAUTHN_RP_NAME=Gastos Mensais
WEBAUTHN_ORIGIN=https://www.gastosmensais.com.br

# --- o e-mail (Resend por SMTP; ver 1.4) ---
MAIL_SMTP=smtp.resend.com
MAIL_SMTP_PORT=465
MAIL_SMTP_SECURE=true
MAIL_USER=resend
MAIL_PASSWORD=<a API key do painel do Resend, permissão "Sending access">
MAIL_FROM=Gastos Mensais <nao-responda@gastosmensais.com.br>

# --- os links que saem por e-mail ---
# Aponta para o FRONT, nunca para a API. Sem ela o link é montado com o Host da requisição, e um
# Host forjado vira um link de recuperação de senha apontando para o servidor de outra pessoa.
APP_URL=https://www.gastosmensais.com.br

# DB_PORT=5432   — só se o Postgres sair da porta padrão; ausente, o Knex usa 5432
```

**Três armadilhas deste arquivo, todas silenciosas:**

- **`NODE_ENV` e `TZ` não entram aqui.** As duas vêm do `environment:` do `docker-compose.yml`,
  porque as duas são lidas antes de qualquer `dotenv` — e o compose vence o `env_file` de
  qualquer jeito. Escrevê-las aqui é escrever algo que não tem efeito;
- **`MAIL_SMTP_SECURE` é comparado com `=== "true"`, exato.** `True`, `TRUE` ou um espaço depois
  do `e` viram `false` em silêncio, e na porta 465 isso é e-mail que **nunca sai**, sem erro
  visível para o usuário;
- **`MAIL_USER=resend` é a palavra literal**, não um endereço. O remetente é o `MAIL_FROM`, e
  não o login do SMTP — é por isso que o domínio precisa estar verificado.

Confira que o compose leu o que você escreveu **antes** de construir qualquer coisa:

```bash
docker compose config | grep -E 'POSTGRES_|MAIL_|APP_URL|WEBAUTHN_|NODE_ENV|TZ:'
```

Leia a saída de verdade: é a única vez em que os valores aparecem lado a lado, já interpolados.
Se faltar `DB_LOGIN`, `DB_PASSWORD` ou `DB_SCHEMA`, o comando para aqui com a mensagem do `:?`
do compose dizendo qual delas — em vez de subir um Postgres sem senha. `NODE_ENV: production` e
`TZ: America/Sao_Paulo` têm de aparecer mesmo sem estarem no `.env`: eles vêm do compose.

### 1.4 O e-mail do domínio (só no servidor, e uma vez só)

O provedor é o **Resend, por SMTP**. Ele **não altera uma linha de código**: o `Mailer` da API é
nodemailer sobre SMTP genérico, e tudo abaixo é painel, DNS e as `MAIL_*` do passo anterior.

1. No painel do Resend, criar uma API key com permissão **Sending access** — é ela que vai em
   `MAIL_PASSWORD`.
2. Verificar o domínio **`gastosmensais.com.br`**, o **apex**. É o domínio do `From:`, e é o
   `From:` que o DMARC avalia — verificar `www` não serve de nada aqui. (O `APP_URL` continua
   sendo o `www`: são coisas diferentes.)
3. Colar no DNS da Cloudflare os registros de **SPF** e **DKIM** que o painel gera. **Todos os
   registros de e-mail ficam DNS-only, nuvem cinza** — atrás do proxy eles não resolvem, e a
   verificação fica pendurada sem dizer por quê. No campo *Nome*, a Cloudflare já completa o
   domínio: não o repita, ou o registro nasce em `_dkim.gastosmensais.com.br.gastosmensais.com.br`.
4. **Escrever o DMARC à mão** — nenhum provedor o escreve por você, porque ele é uma política
   sobre o seu domínio e não sobre o serviço:

   | Campo | Valor |
   | --- | --- |
   | Tipo | `TXT` |
   | Nome | `_dmarc` |
   | Conteúdo | `v=DMARC1; p=none; rua=mailto:<uma caixa que você lê de verdade>; fo=1; adkim=r; aspf=r` |
   | Proxy | **DNS only** |

   O `rua` precisa ser um endereço que **exista** — é para onde vão os relatórios diários, e é a
   única razão de `p=none`. `p=none` é ponto de partida: sobe para `quarantine` e depois para
   `reject` depois de algumas semanas lendo os relatórios, e não antes. Subir direto em `reject`
   é transformar o primeiro erro de configuração em silêncio total.
5. Conferir o limite do plano gratuito **no painel do Resend**, na tela de uso. A ordem de
   grandeza que se comenta é 3.000 mensagens por mês com teto diário na casa da centena — **não
   confirmado na documentação pública**, e é um limite de produto, não de infra: é o número que
   decide quando este plano deixa de servir.

A prova de que isso funcionou é a lista de fumaça, item
[e-mail](#e-mail--dois-fluxos-não-três) — e só ela. **Um envio sem erro no log não é um e-mail
entregue.**

### 1.5 Construir e subir

```bash
docker compose build
docker compose run --rm --entrypoint nginx proxy -t
docker compose up -d
docker compose ps
```

O `build` do primeiro dia demora: são três imagens, dois `npm ci` e o webpack, no processador do
servidor. Espere os **quatro** serviços em `running`, e `db`, `api` e `proxy` em `healthy`.

**O `nginx -t` no meio não é cerimônia.** O `proxy` é o único serviço que o `build` aceita e o
boot rejeita: o certificado que ele lê vem de um volume do host, não da imagem, e um par
trocado ou um arquivo ausente só aparece quando o processo tenta subir. Rodá-lo antes do
`up -d` transforma isso numa mensagem legível em vez de um container reiniciando em laço.

**O log vai gritar `relation "RotineRuns" does not exist` a cada tick, e isso é normal aqui.** O
banco existe e está vazio: subir e migrar são duas ações, de propósito. A mensagem para no passo
seguinte. Só é incidente se continuar **depois** do `migrate:prod`.

### 1.6 A migration

```bash
docker compose exec api npm run migrate:prod
```

A linha que importa é `Batch 1 run: <N> migrations` — hoje são **28**. Ela **não** é a última da
saída: o `npm` costuma imprimir um `npm notice` sobre versão nova depois dela, e isso não é erro.
Detalhes e o rollback estão no [procedimento 3](#3-migration-e-rollback).

Confira que a API respondeu e que o fuso pegou:

```bash
docker compose exec api date          # precisa dizer -03. Se disser UTC, o tzdata da imagem sumiu
curl -s http://127.0.0.1/healthz      # "ok" — prova que o nginx de borda está de pé
curl -sk --resolve www.gastosmensais.com.br:443:127.0.0.1      https://www.gastosmensais.com.br/api/Utils/Health
curl -sI --resolve www.gastosmensais.com.br:80:127.0.0.1      http://www.gastosmensais.com.br/ | head -1        # 301
curl -skI --resolve gastosmensais.com.br:443:127.0.0.1        https://gastosmensais.com.br/ | head -2           # 301 para o www
```

**O `--resolve` não é firula, e sem ele a leitura fica errada.** Um `curl https://127.0.0.1/`
manda `127.0.0.1` como SNI e como `Host`: isso não casa com o `server_name` do app, cai no
`default_server` de `deploy/proxy/nginx.conf` e a conexão é fechada sem resposta (444) — que se
lê como "o app não subiu". O `--resolve` mantém o nome e força só o destino. O `-k` é porque o
certificado de origem da Cloudflare não é confiável para o `curl`, e não precisa ser.

O `date` é a prova que não se pode pular: `TZ=America/Sao_Paulo` sem o pacote de fusos na imagem
**não dá erro** — a libc ignora o valor e o processo fica em UTC, com a variável ali,
aparentemente certa. O `docker compose config` mostraria o valor correto de qualquer jeito.

### 1.7 O certificado e a Cloudflare (só no servidor)

**Não há mais nginx do host.** Quem termina o TLS é o container `proxy`, construído de
`deploy/proxy/nginx.conf` — versionado, revisado em diff e idêntico em qualquer máquina. O que
continua fora do repositório é só o segredo: o par de certificado e chave, montado como volume
`:ro`.

O certificado de origem da Cloudflare, em `/etc/ssl/cloudflare/`, dono `root`, chave **600** —
os nomes dos arquivos estão escritos dentro do `nginx.conf` e não são livres:

```bash
sudo install -d -m 0755 /etc/ssl/cloudflare
sudo install -m 0644 -o root -g root <cert>.pem /etc/ssl/cloudflare/gastosmensais.com.br.pem
sudo install -m 0600 -o root -g root <key>.key  /etc/ssl/cloudflare/gastosmensais.com.br.key
```

Confira que o par bate — os dois `md5` têm de ser **iguais**. Um certificado com a chave de
outro falha no boot do `proxy` com uma mensagem que não diz qual dos dois arquivos está errado:

```bash
sudo openssl x509 -noout -modulus -in /etc/ssl/cloudflare/gastosmensais.com.br.pem | openssl md5
sudo openssl rsa  -noout -modulus -in /etc/ssl/cloudflare/gastosmensais.com.br.key | openssl md5
```

Trocar o certificado depois **não exige rebuild**, porque ele não está na imagem:

```bash
docker compose restart proxy
```

**Na Cloudflare, quatro coisas, e nenhuma é opcional:**

- **SSL/TLS = Full (strict)**. Nunca *Flexible*: em Flexible a Cloudflare fala `http` com a
  origem, o tráfego entre as duas atravessa a internet em claro (o cookie de sessão e o corpo do
  login junto), o `X-Forwarded-Proto` chega como `http` e o HSTS nunca sai — e **nada disso
  aparece no cadeado do navegador**, porque o cadeado é o dela;
- **Always Use HTTPS** ligado;
- **DNS: o apex e o `www`, os dois proxiados** (nuvem laranja). Os registros de e-mail do passo
  1.4 são a exceção, e ficam cinza. **Desligar a nuvem laranja derruba o app**: o certificado de
  origem não é confiável para um navegador, e quem o valida é a Cloudflare;
- As faixas de IP da Cloudflare dentro de `deploy/proxy/nginx.conf` estão datadas de
  **11/09/2026** e **envelhecem**. Uma lista desatualizada não dá erro: o `set_real_ip_from`
  deixa de casar, o `$remote_addr` volta a ser o do datacenter, e todo usuário que entrar por uma
  faixa nova vira um IP só para o rate limiting. Reconferir em
  <https://www.cloudflare.com/ips-v4> junto com a atualização do servidor — e, como a lista vive
  no repositório, a atualização dela é um commit e um `docker compose build proxy`.

### 1.8 O backup (só no servidor)

O diretório é criado **à mão, uma vez**, e o script não o cria de propósito: um erro de digitação
em `BACKUP_DIR` viraria um diretório novo e vazio em vez de uma falha, e o backup iria todo dia
para o lugar errado com o timer verde.

```bash
sudo install -d -m 0700 -o root -g root /var/backups/gastosmensais
sudo cp deploy/gastosmensais-backup.service deploy/gastosmensais-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gastosmensais-backup.timer
```

Se o clone não estiver em `/opt/gastosmensais`, edite o `WorkingDirectory` **e** o `ExecStart` do
`.service` antes do `cp` — as duas linhas mudam juntas.

Force uma execução agora, sem esperar as 3h30:

```bash
sudo systemctl start gastosmensais-backup
journalctl -u gastosmensais-backup -n 50
sudo ls -lh /var/backups/gastosmensais/
systemctl list-timers gastosmensais-backup
```

**O `sudo` do `ls` não é distração.** O diretório é `0700 root:root` porque o dump é o banco
inteiro em claro, e sem ele a resposta é `Permission denied` — que se lê como "o backup falhou"
quando é o contrário: é a permissão certa. Vale para todo acesso a `/var/backups/gastosmensais/`
daqui em diante, inclusive os do [procedimento 5](#5-restaurar-o-backup).

E **restaure esse primeiro dump** antes de considerar o backup existente: o ensaio geral do
[procedimento 5](#5-restaurar-o-backup). Um backup nunca restaurado não é backup, é um arquivo
com nome tranquilizador.

### 1.9 Antes de chamar de no ar

Rode a [lista de fumaça](#6-a-lista-de-fumaça) inteira.

---

## 2. Atualizar

```bash
cd /opt/gastosmensais
git pull
docker compose build
docker compose up -d
docker compose ps
```

E, se o `git pull` trouxe arquivo novo em `API/migrations/`, o
[procedimento 3](#3-migration-e-rollback).

> ### `docker compose build` sem nome de serviço. Sempre.
>
> **`docker compose build web` e `docker compose build api` são comandos válidos, e é por isso
> que este aviso existe.** O repositório único garantia sozinho que os dois lados andassem no
> mesmo passo — um commit era o produto —, e a partir do momento em que `web` e `api` são
> duas imagens separadas, essa garantia passa a depender de quem digita. (O `proxy` é a
> terceira imagem e fica fora deste raciocínio: ele não carrega código do app, e reconstruí-lo
> sozinho depois de mexer em `deploy/proxy/nginx.conf` é legítimo.)
>
> O caso que dói é a versão dos documentos legais. Ela vive em **duas constantes, em dois lados
> e dois formatos**: `API/routes/Users/sections/TermsVersion.ts` (`"2026-09-11"`), que é o que a
> API carimba no banco, e `Frontend/src/pages/Legal/LegalLayout.tsx` (`"11/09/2026"`), que é o
> que o usuário lê. **Nenhum teste as amarra, e não há como**: cada suíte roda de um lado só e
> compara a sua constante consigo mesma.
>
> Com o front novo e a API velha, a pessoa lê o documento de hoje, clica em aceitar, e o banco
> registra que ela aceitou o de ontem. Nada dá erro, e a prova do erro é o próprio registro —
> que é exatamente o buraco que o re-aceite existe para fechar.

### Quando rodar a migration, em relação ao `up -d`

- **Migration compatível com a versão antiga do código** (acrescenta coluna anulável, cria
  tabela, cria índice): rode **antes** do `up -d`. A API velha continua funcionando e o downtime
  é só o do `up -d`;
- **Migration incompatível** (renomeia, apaga, torna coluna obrigatória): rode **entre** o `build`
  e o `up -d`, aceitando que existe uma janela de segundos em que a API antiga está falando com o
  banco novo. É por isso que ela vem depois do `build`, que é a parte demorada: a janela é a do
  `up -d`, e não a da construção da imagem.

### O que esperar do reinício

`docker compose up -d` **derruba a API por alguns segundos** — não há zero-downtime aqui, e é
aceitável. O encerramento ordenado espera a requisição em voo e o tick de rotina antes de fechar;
com o container saudável, ele leva menos de um segundo.

**Uma exceção que engana:** um `docker compose start api` seguido de `stop` **imediato** sai por
`SIGKILL`, com código **137**. O SIGTERM se perde na transição, e não é um bug do encerramento —
espere o container ficar `healthy` antes de pará-lo e a saída volta a ser limpa.

---

## 3. Migration e rollback

**A migration nunca roda no boot.** Não há `entrypoint` que a chame: com `restart:
unless-stopped`, uma migration que falha viraria um container em laço de reinício tentando migrar
um banco quebrado várias vezes por minuto, e o rollback deixaria de ser uma decisão humana.

```bash
# aplicar
docker compose exec api npm run migrate:prod

# desfazer o último lote — o comando que ninguém lembra na hora
docker compose exec api npx knex migrate:rollback --knexfile build/knexfile.js
```

**O `migrate:rollback` do `package.json` não serve aqui**, e é a pegadinha desta seção: ele aponta
para `knexfile.ts`, que existe na sua máquina e **não existe dentro da imagem** — o que viaja para
produção é o `build/knexfile.js`, e só o `migrate:prod` já vem apontando para ele. Rodar
`npm run migrate:rollback` no container falha assim:

```
No configuration file found and no commandline connection parameters passed
```

**A mensagem não diz "knexfile.ts não existe", e é por isso que ela está transcrita aqui**: lida
às duas da manhã, ela parece falta de credencial — e o `.env` está certo. O rollback se escreve
inteiro, como acima.

**Se o container `api` não estiver de pé**, o `exec` não tem onde entrar. A mesma migration roda
num container descartável, com o mesmo ambiente:

```bash
docker compose run --rm api npm run migrate:prod
```

Para ver o estado antes de decidir:

```bash
docker compose exec api npx knex migrate:list --knexfile build/knexfile.js
```

**O `rollback` desfaz o lote inteiro, não a última migration.** Se três migrations subiram juntas
no mesmo `migrate:prod`, o rollback derruba as três. E migration que apaga coluna **não tem
`down` que traga o dado de volta**: nesse caso o caminho não é o rollback, é o
[procedimento 5](#5-restaurar-o-backup).

**Antes de qualquer migration de risco, force um backup** — leva segundos e é a diferença entre
um susto e um incidente:

```bash
sudo systemctl start gastosmensais-backup && sudo ls -lt /var/backups/gastosmensais/ | head -3
```

---

## 4. Ver o log

```bash
docker compose logs -f api          # a aplicação, ao vivo
docker compose logs --tail=200 api  # as últimas 200 linhas e sai
docker compose logs -f              # os quatro serviços, entrelaçados
docker compose logs db              # o Postgres
docker compose logs proxy           # o nginx de borda: TLS, 301, 444 e erro de certificado
```

**Um 502 na tela quase nunca está no log do `proxy`.** Ele registra o que *ele* fez; quem
recusou a conexão foi o `web` ou a `api`, e é o log deles que diz por quê. A ordem de leitura
num incidente é `api`, depois `web`, e o `proxy` só quando o sintoma é TLS, redirecionamento ou
conexão fechada sem resposta.

**Não procure por uma pasta `Logs/`.** Ela não existe dentro do container e não existe no
servidor: em `NODE_ENV=production` a aplicação escreve no **stdout**, e o log é o do Docker. É
por isso que os quatro serviços declaram rotação (`json-file`, 10 MB × 3) — sem ela, o padrão do
Docker cresce para sempre, e num servidor pessoal o disco cheio derruba o Postgres junto.

Os arquivos, se precisar olhar o disco:

```bash
docker inspect --format='{{.LogPath}}' "$(docker compose ps -q api)"
du -sh /var/lib/docker/containers/
```

E o resto do diagnóstico:

```bash
docker compose ps                                    # quem está de pé, e quem está healthy
docker inspect --format='{{json .State.Health}}' "$(docker compose ps -q api)"
docker compose exec api date                         # o fuso

# as tabelas. As aspas SIMPLES são obrigatórias: quem expande $POSTGRES_USER é o shell de
# DENTRO do container, onde a variável existe. O seu shell não tem o `.env` carregado, e um
# `-U "$DB_LOGIN"` daqui vira `-U ""`.
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'

docker compose exec proxy nginx -t                   # a configuração da borda, já no ar
journalctl -u gastosmensais-backup -n 50             # o backup
```

---

## 5. Restaurar o backup

Os dumps são `pg_dump -Fc` (formato custom, indexado e já comprimido), em
`/var/backups/gastosmensais/`, com retenção de 14 dias. O formato é custom justamente para
permitir restaurar **uma tabela só**: o dia em que este procedimento for usado, será
provavelmente por causa de uma migration ruim ou de um `delete` errado, e nesses casos restaurar
o banco inteiro é desfazer o trabalho de todos os outros usuários junto.

Comece escolhendo o arquivo:

```bash
DUMP=$(sudo sh -c 'ls -1t /var/backups/gastosmensais/*.dump | head -1')
echo "$DUMP"
sudo cat "$DUMP" | docker compose exec -T db pg_restore --list | head   # prova que o arquivo está inteiro
```

Um arquivo `.part` no diretório é um dump que **não terminou** — nunca o use. O `ls` acima só
pega `.dump` de propósito.

**Por que `sudo sh -c` e `sudo cat |`, e não `sudo ls` e `< "$DUMP"`.** O diretório é `0700
root:root` (passo [1.8](#18-o-backup-só-no-servidor)), e quem expande o `*.dump` e quem abre o
`<` é o **seu** shell, não o `sudo` — os dois falham com `Permission denied` antes de o Docker
ser chamado. Daí o `sudo sh -c` (o glob roda como root) e o `sudo cat` (o arquivo é aberto como
root e desce pelo cano). Todos os blocos abaixo seguem a mesma forma.

### 5.1 Ensaio geral, num banco descartável

É o teste que prova que o backup existe, e **não toca no banco de produção**:

```bash
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" gastosmensais_restore_test'
sudo cat "$DUMP" | docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d gastosmensais_restore_test --no-owner'
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d gastosmensais_restore_test -c "select (select count(*) from \"Users\") as users, (select count(*) from \"Workspaces\") as workspaces, (select count(*) from \"Accounts\") as accounts, (select count(*) from \"Expenses\") as expenses, (select count(*) from \"ExpensePayments\") as pernas"'
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" gastosmensais_restore_test'
```

O `--no-owner` está aí porque o banco descartável é criado pelo usuário da aplicação e o dump
carrega os donos originais — sem ele o `pg_restore` sai com avisos de `ALTER OWNER` que não são o
que se está testando. **Num restore de verdade, para o mesmo cluster e o mesmo dono, ele não é
usado.**

**O que prova o restore é o `count(*)` bater com a produção, não a ausência de texto em
amarelo**: o `pg_restore` pode terminar com avisos (extensões, comentários) e código de saída 0.

### 5.2 Uma tabela só

Restaurar por cima de uma tabela que existe exige **limpá-la antes** — o `pg_restore` só faz
`COPY`/`INSERT`, não apaga nada, e sem o `truncate` o resultado é a tabela com as linhas
duplicadas:

```bash
sudo cat "$DUMP" | docker compose exec -T db pg_restore --list     # o que existe dentro do arquivo
sudo cat "$DUMP" | docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t Expenses --data-only'
```

### 5.3 O banco inteiro — o caso do desastre

O banco de produção é **recriado**, e por isso a API desce antes e sobe depois: um `pg_restore`
com a API escrevendo por cima é a única forma de terminar com um banco pior do que o que se
tinha.

```bash
docker compose stop api
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
sudo cat "$DUMP" | docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose start api
docker compose logs --tail=50 api
```

Depois de um restore inteiro, rode `npm run migrate:prod` ([procedimento 3](#3-migration-e-rollback)):
o dump é do esquema do dia em que foi tirado, e o código no ar pode estar à frente dele.

### O registro dos ensaios

**Um backup nunca restaurado não é backup.** Cada execução do [5.1](#51-ensaio-geral-num-banco-descartável)
ganha uma linha aqui, com a data e se o `count(*)` bateu. Repetir isto a cada poucos meses é o que
mantém a frase acima verdadeira.

| Data | Dump testado | `count(*)` bateu? | Quem |
| --- | --- | --- | --- |
| 11/09/2026 | `pg_dump -Fc` do compose na **máquina de desenvolvimento**, banco recém-migrado e vazio | sim (0 em todas; 28 linhas em `knex_migrations` depois do 5.3) | validação do procedimento, na escrita deste documento |

A linha acima valida **os comandos**, não o backup do servidor: ela foi feita na máquina de
desenvolvimento, sem `/var/backups` e sem o timer. **A primeira linha que conta é a do servidor**,
com um dump do timer e um banco com dado dentro.

---

## 6. A lista de fumaça

**Não é só do primeiro deploy.** Repita a cada deploy grande — a maioria destes itens só falha em
produção, e nenhum deles é `npm test`.

### O básico, do próprio servidor

- [ ] `docker compose ps` — os quatro `running`, e `db`, `api` e `proxy` `healthy`;
- [ ] `docker compose exec api date` diz **`-03`**. É a prova do `tzdata`, e o `compose config`
      não substitui;
- [ ] `curl -s http://127.0.0.1/healthz` responde `ok`;
- [ ] `curl -sk --resolve www.gastosmensais.com.br:443:127.0.0.1
      https://www.gastosmensais.com.br/api/Utils/Health` responde — o `--resolve` é obrigatório,
      e o porquê está no [passo 1.6](#16-a-migration);
- [ ] o log **não** repete `relation "RotineRuns" does not exist` — se repetir, a migration não
      rodou;
- [ ] **só a 80 e a 443 respondem do IP público.** As duas são do `proxy`, e nenhum outro
      serviço publica porta: `docker compose ps` não mostra `->` em `db`, `api` nem `web`;
- [ ] chegar pelo **IP nu** não serve o app: `curl -k --max-time 5 https://<ip público>/` fecha
      sem resposta (é o `default_server` devolvendo 444), e não devolve a página;
- [ ] o Postgres **não** é alcançável de fora: `psql -h <ip do servidor> -p 5432` recusa;
- [ ] `docker compose down && docker compose up -d` preserva os dados — o volume `pgdata` é
      nomeado, e só um `-v` o apaga.

### O navegador, no domínio real

- [ ] `https://www.gastosmensais.com.br` abre, e o **apex redireciona** para ele — digitar
      `gastosmensais.com.br` tem de acabar na barra de endereço com o `www`, não abrir o app no
      apex. É a prova do canônico, e é dela que dependem a sessão (o cookie é host-only: no apex
      seria outra) e a biometria (o `WEBAUTHN_ORIGIN` só tem o `www`);
- [ ] **atualizar a página** em `/privacidade` devolve o app, não o 404 do nginx (é o `try_files`);
- [ ] o cabeçalho `Content-Security-Policy` vem na resposta da página;
- [ ] um arquivo de `/assets/` vem com `Cache-Control: immutable`, e o `index.html` **não**;
- [ ] **nenhuma** requisição para `fonts.googleapis.com` ou `fonts.gstatic.com`, em nenhuma tela;
- [ ] o `logo.png` de 761 KB **não** aparece no painel de rede ao carregar o login, e a aba do
      navegador mostra o ícone;
- [ ] `/robots.txt` responde o texto certo (bloqueia tudo, libera `/termos` e `/privacidade`);
- [ ] "adicionar à tela inicial", no celular, usa o nome e o ícone do manifesto.

### A sessão e a cadeia de proxies

- [ ] o cookie `token` chega com **`Secure`** e **`SameSite=Strict`** (é a prova do
      `NODE_ENV=production`);
- [ ] `Strict-Transport-Security` vem nas respostas da API (é a prova do `X-Forwarded-Proto`);
- [ ] **o IP real:** errar a senha do login **seis vezes** de um celular na rede móvel **não**
      bloqueia o login de outro dispositivo. Se bloquear, a API está vendo um IP só para todo
      mundo — o `X-Forwarded-For` está errado em algum ponto da cadeia, e o lugar de olhar é o
      `proxy_set_header` de `deploy/proxy/nginx.conf` (que **sobrescreve**) e o do
      `Frontend/deploy/nginx.conf` (que **repassa**, sem acrescentar salto). Confira o que a API
      enxerga pelo log de acesso do `proxy` antes de mexer em `trust proxy`;
- [ ] o modo SSL da Cloudflare lê **Full (strict)**;
- [ ] a biometria **cadastra e autentica** no domínio real (é a prova do `WEBAUTHN_RP_ID` e do
      `WEBAUTHN_ORIGIN`). `Unexpected registration response origin` aqui não é erro de código: é
      a origem da barra de endereço não constando da lista — confira que você está no canônico.

### As duas imagens são do mesmo commit

- [ ] criar uma conta, e conferir que a data impressa no topo de `/privacidade` é a mesma que a
      conta acabou de gravar. O que o banco gravou se lê assim:

      ```bash
      docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select \"Email\", \"TermsVersion\", \"TermsAcceptedAt\" from \"Users\" order by \"IdUser\" desc limit 1"'
      ```

      A tela mostra `11/09/2026` e o banco grava `2026-09-11`: **é a mesma data em dois
      formatos**, e é exatamente isso que se está conferindo;
- [ ] o **modal de re-aceite não aparece** logo depois do cadastro. Se aparecer, `web` e `api`
      são de commits diferentes: volte ao `docker compose build` **sem nome de serviço**.

### E-mail — dois fluxos, não três

São **dois** os fluxos do produto que mandam e-mail: a **confirmação de cadastro** e a
**recuperação de senha**. O **convite de workspace não manda e-mail** — a API devolve o link e
quem o entrega é o usuário. Não procure um terceiro.

Para cada um dos dois, com uma caixa do **Gmail** e uma do **Outlook**:

- [ ] a mensagem chega **na caixa de entrada**, não no spam;
- [ ] o cabeçalho original mostra `spf=pass`, `dkim=pass` e `dmarc=pass` — no Gmail em
      `⋮` → *Mostrar original*; no Outlook em `⋯` → *Exibir* → *Exibir origem da mensagem*;
- [ ] o link do e-mail abre o **domínio de produção** (é a prova do `APP_URL`).

### O produto, que é o que fecha

Pelo **celular, fora da rede de casa**, no domínio real:

- [ ] criar uma conta de verdade, confirmar pelo e-mail e entrar;
- [ ] criar uma conta bancária;
- [ ] lançar um gasto parcelado em **6×** no cartão;
- [ ] o mês corrente mostra **uma perna**, não o total;
- [ ] virar o mês e ver a segunda perna.

E um item que depende do calendário, e por isso fica pendurado: no **primeiro fim de mês** depois
da subida, abrir `GET /Reports/Month` sem parâmetro **às 22h do último dia do mês** e conferir
que ele responde sobre o mês **corrente**, não o seguinte. É a única verificação daqui que não se
pode antecipar.
