# Começando do zero — da VPS crua ao app no ar

**Este documento é o caminho de ida, uma vez só.** Ele começa numa VPS recém-comprada, em que
você só tem um IP e uma senha de `root`, e termina com o app respondendo no domínio real. Tudo
que vem *depois* — atualizar, migrar, ler log, restaurar backup — é o
[Deploy.md](Deploy.md), e este documento entrega você lá no fim.

A divisão entre os dois é por assunto, e vale entender antes de começar:

| Documento | O que cobre |
| --- | --- |
| **Este** | A **máquina**: usuário, SSH, firewall, Docker, git, certificado. Nada disso muda quando o app muda |
| [Deploy.md](Deploy.md) | O **app**: `.env`, build, migration, backup, log, restore, lista de fumaça. É o que se repete a cada deploy |

Onde este documento manda você para o `Deploy.md`, **vá e volte**. Duplicar aquele conteúdo aqui
criaria duas cópias da mesma verdade, e a segunda cópia é sempre a que fica desatualizada.

## Antes de abrir o terminal

Tenha estas cinco coisas em mãos. Faltando qualquer uma, você trava no meio:

- [ ] O **IP público** da VPS e a credencial de `root` que o provedor mandou;
- [ ] O domínio **`gastosmensais.com.br` com o DNS na Cloudflare** (nameservers já apontados —
      isso leva horas para propagar, e é o único passo daqui que você não controla);
- [ ] Acesso ao **painel da Cloudflare** com permissão de criar certificado de origem;
- [ ] Uma conta no **Resend** com o domínio verificado, ou a disposição de fazer isso no
      [passo 1.4 do Deploy.md](Deploy.md#14-o-e-mail-do-domínio-só-no-servidor-e-uma-vez-só);
- [ ] Acesso de escrita ao **repositório no GitHub**, para cadastrar a chave de deploy.

Os comandos assumem **Ubuntu LTS**. Em Debian muda uma linha, e ela está marcada no passo 5.

---

## 1. O primeiro acesso, e fechar a porta atrás de você

### 1.1 Entrar como root

```bash
ssh root@<ip da vps>
```

### 1.2 O seu usuário

Trabalhar como `root` o tempo todo é o que transforma um erro de digitação em reinstalação.
Crie o seu usuário e dê `sudo` a ele:

```bash
adduser tiago                    # ele pergunta a senha; o resto pode ficar em branco
usermod -aG sudo tiago
```

**Essa senha não vai servir para entrar por SSH** — o passo 1.4 desliga login por senha. Ela é
para o `sudo`. Escolha algo que você consiga digitar, e guarde.

### 1.3 A chave SSH

**Gere a chave na sua máquina, nunca na VPS.** A chave privada não deve existir em dois lugares,
e a VPS é o lugar onde ela menos deve estar.

No **seu computador** (PowerShell no Windows serve):

```bash
ssh-keygen -t ed25519 -C "tiago@gastosmensais-vps"
```

Aceite o caminho padrão e **ponha uma senha na chave**. Depois, ainda na sua máquina:

```bash
ssh-copy-id tiago@<ip da vps>
```

Se o `ssh-copy-id` não existir no Windows, cole a chave pública à mão — na VPS, como `tiago`:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys       # cole aqui o conteúdo de ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
```

**As permissões não são decorativas.** O `sshd` recusa em silêncio um `authorized_keys` que o
grupo ou outros possam ler, e o sintoma é ele pedir senha como se a chave não existisse.

Agora **abra uma segunda janela de terminal** e teste:

```bash
ssh tiago@<ip da vps>
```

### 1.4 Endurecer o `sshd`

> **Mantenha a sessão atual aberta enquanto faz isto.** Se o `sshd` subir com uma configuração
> que você não previu, a sessão aberta é a única forma de consertar sem o console de emergência
> do provedor.

```bash
sudo nano /etc/ssh/sshd_config
```

Três linhas, cada uma com o valor abaixo (descomente se estiverem comentadas):

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

**A armadilha desta seção está em outro arquivo.** As imagens de nuvem de Ubuntu trazem um
`/etc/ssh/sshd_config.d/60-cloudimg-settings.conf` com `PasswordAuthentication yes` dentro, e o
`Include` no topo do `sshd_config` faz esse arquivo **vencer** o que você acabou de escrever.
Editar só o arquivo principal não dá erro — dá um servidor que continua aceitando senha. Confira:

```bash
sudo grep -rn "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null
```

Corrija o que aparecer em `sshd_config.d/`, valide e recarregue:

```bash
sudo sshd -t                      # sintaxe. Se falhar, NÃO reinicie
sudo systemctl restart ssh
```

A prova é `sudo sshd -T | grep -E "permitrootlogin|passwordauthentication"` — é a configuração
**efetiva**, com os includes já resolvidos, e é a única leitura que vale. Depois disso, abra uma
terceira janela e confirme que você ainda entra. Só então feche as outras.

### 1.5 Fuso, hostname e relógio

```bash
sudo timedatectl set-timezone America/Sao_Paulo
sudo hostnamectl set-hostname gastosmensais
timedatectl                       # confira "System clock synchronized: yes"
```

**O fuso do host não é o fuso do app.** Os containers recebem `TZ=America/Sao_Paulo` do
`docker-compose.yml`, e é aquele valor que decide o mês que a API enxerga. O fuso daqui serve
para o `journalctl`, para o nome dos arquivos de backup e para você não fazer conta de cabeça às
duas da manhã.

---

## 2. O sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades     # responda "sim"
```

### A swap

```bash
free -h
```

**Se a VPS tiver 4 GB de RAM ou menos, crie swap antes de qualquer build.** O passo mais faminto
de memória do deploy inteiro é o `npm run build` do front — `tsc -b && vite build`, com o
`echarts` na árvore. Sem swap, num servidor pequeno, ele é morto pelo kernel (saída **137**) ou
entra em thrash e roda por horas:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                           # o Swap tem de aparecer
```

Com 8 GB ou mais, a swap é opcional — mas ela custa 4 GB de disco e transforma um `Killed` num
build lento, o que é sempre a troca melhor.

---

## 3. O firewall, e por que ele não protege o Docker

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status verbose
```

> ### O `ufw` não cobre as portas que o Docker publica
>
> **Isto não é uma configuração errada, é como o Docker funciona**, e é a coisa mais
> contraintuitiva deste documento. O daemon escreve as próprias regras no `iptables` **antes**
> das do `ufw`: uma porta publicada por um container fica aberta no IP público mesmo com o
> `ufw status` jurando que está fechada.
>
> Por isso o desenho do `docker-compose.yml` **não depende do firewall**: `db`, `api` e `web`
> não publicam porta nenhuma, e quem publica é só o `proxy` — justamente as duas portas que
> devem mesmo estar abertas. O `ufw` acima protege o que **não** é Docker, e o SSH é o que
> importa ali.

### Opcional, e não no primeiro dia: só a Cloudflare alcança a origem

Com o proxy laranja ligado, ninguém *precisa* chegar à 80 e à 443 direto no IP — só a Cloudflare.
Fechar isso para o resto do mundo se faz na cadeia `DOCKER-USER`, que é avaliada antes das regras
que o Docker gera:

```bash
IFACE=$(ip route get 1.1.1.1 | awk '{print $5; exit}')      # confira o nome antes de seguir
echo "$IFACE"

# 1) A regra que bloqueia, primeiro — ela vai sendo empurrada para baixo pelas de cima.
sudo iptables -I DOCKER-USER 1 -i "$IFACE" -p tcp -m multiport --dports 80,443 -j DROP

# 2) As faixas da Cloudflare por cima dela, cada -I entrando na posição 1.
for R in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo iptables -I DOCKER-USER 1 -i "$IFACE" -p tcp -m multiport --dports 80,443 -s "$R" -j ACCEPT
done

sudo iptables -L DOCKER-USER -n --line-numbers | head -30
```

**Confira que o site continua abrindo antes de tornar isso permanente** (`apt install
iptables-persistent`). A ordem importa e é fácil de inverter: um `-A` no lugar de um `-I` põe a
regra **depois** do `RETURN` que já existe na cadeia, onde ela nunca é alcançada — e o resultado
é uma regra que parece instalada e não faz nada.

Isso protege contra quem descobriu o IP de origem. **Não faça no primeiro dia**: suba o app,
prove que funciona, e só então feche. Um erro aqui é o site fora do ar sem mensagem de erro.

---

## 4. Git e o acesso ao repositório

O `git` já veio no passo 2. Falta a VPS conseguir ler o repositório — e a forma certa é uma
**deploy key**, que é uma chave com acesso a **um** repositório, só de leitura, e não a sua conta
inteira.

Na VPS:

```bash
ssh-keygen -t ed25519 -C "vps-gastosmensais" -f ~/.ssh/id_github -N ""
cat ~/.ssh/id_github.pub
```

**`-N ""` (sem senha) é deliberado aqui**, ao contrário da chave do passo 1.3: esta chave é usada
por um `git pull` que ninguém está olhando, e uma senha nela significa um deploy que trava
esperando alguém digitar.

Copie a saída do `cat` e cadastre no GitHub em **Settings → Deploy keys → Add deploy key**, do
repositório do projeto. **Deixe "Allow write access" desmarcado** — o servidor só lê.

Aponte o git para essa chave:

```bash
cat >> ~/.ssh/config <<'FIM'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_github
    IdentitiesOnly yes
FIM
chmod 600 ~/.ssh/config
```

E aceite a chave de host do GitHub agora, num momento em que você está olhando — e não no meio
do primeiro `clone`:

```bash
ssh -T git@github.com
```

A resposta certa é `Hi <repo>! You've successfully authenticated, but GitHub does not provide
shell access.` **Isso não é um erro** — é o que o sucesso parece com uma deploy key.

---

## 5. Docker

**Não instale pelo `apt install docker.io`.** O pacote da distribuição é antigo e, pior, não traz
o plugin `compose` v2 — você acabaria com o `docker-compose` de hífen, que tem comportamento
diferente e não é o que este repositório assume.

O repositório oficial:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **Em Debian**, troque `linux/ubuntu` por `linux/debian` nas duas linhas. O resto é igual.

### O grupo `docker`

**Este é o passo que todo mundo pula, e ele custa uma hora.** Sem ele, todo comando `docker`
responde `permission denied while trying to connect to the Docker daemon socket` — e a saída
reflexa é prefixar tudo com `sudo`, que funciona e deixa você com metade dos comandos rodando
como `root` e metade não.

**Todos os comandos do [Deploy.md](Deploy.md) são `docker compose` sem `sudo`, e é assim que eles
devem ser rodados.**

```bash
sudo usermod -aG docker $USER
```

**Saia do SSH e entre de novo.** Só o relogin aplica o grupo novo — nem `newgrp`, nem abrir outra
janela da mesma sessão. Depois confirme, e os três comandos têm de passar sem `sudo`:

```bash
id -nG | tr ' ' '\n' | grep docker
docker ps
docker compose version            # "Docker Compose version v2.x" — com espaço, não hífen
```

Estar no grupo `docker` **é equivalente a ter root nesta máquina** — quem pode falar com o daemon
pode montar `/` dentro de um container. Isso é aceitável aqui porque é a sua VPS e o seu usuário;
não é aceitável para uma conta de terceiro.

---

## 6. O clone

```bash
sudo install -d -o "$USER" -g "$USER" /opt/gastosmensais
git clone git@github.com:<usuário>/<repositório>.git /opt/gastosmensais
cd /opt/gastosmensais
```

**O caminho `/opt/gastosmensais` não é decorativo**: ele está escrito dentro de
`deploy/gastosmensais-backup.service`. Clonar em outro lugar significa editar o
`WorkingDirectory` **e** o `ExecStart` daquele arquivo antes de instalá-lo.

O `install -d` com o seu usuário como dono é o que permite o `git pull` de todo deploy sem
`sudo` — um clone feito como `root` deixa o diretório inteiro pertencendo a `root`, e aí ou todo
deploy vira `sudo git pull` ou você conserta dono depois.

---

## 7. A Cloudflare

Quatro coisas no painel, e nenhuma é opcional. Elas vêm **antes** de subir o app porque o
certificado do passo 7.3 é pré-requisito do container `proxy`: sem ele o nginx não sobe.

### 7.1 O DNS

Dois registros `A`, os dois apontando para o IP da VPS, os dois com a **nuvem laranja** (proxy
ligado):

| Tipo | Nome | Conteúdo | Proxy |
| --- | --- | --- | --- |
| `A` | `gastosmensais.com.br` (ou `@`) | `<ip da vps>` | **Laranja** |
| `A` | `www` | `<ip da vps>` | **Laranja** |

Os registros de e-mail do [passo 1.4 do Deploy.md](Deploy.md#14-o-e-mail-do-domínio-só-no-servidor-e-uma-vez-só)
são a exceção e ficam **cinza** — atrás do proxy eles não resolvem, e a verificação do Resend
fica pendurada sem dizer por quê.

**O container de DDNS da máquina antiga não vem junto.** O IP de uma VPS é fixo; um DDNS
reescrevendo esses dois registros é uma peça que só pode errar.

### 7.2 SSL/TLS

- **Modo: Full (strict)**. Nunca *Flexible*. Em Flexible a Cloudflare fala `http` com a origem: o
  tráfego entre as duas atravessa a internet em claro — o cookie de sessão e o corpo do login
  junto —, o `X-Forwarded-Proto` chega como `http` e o HSTS nunca sai. **Nada disso aparece no
  cadeado do navegador**, porque o cadeado é o dela;
- **Always Use HTTPS** ligado.

### 7.3 O certificado de origem

Em **SSL/TLS → Origin Server → Create Certificate**:

- tipo de chave **RSA (2048)**;
- hostnames: **`gastosmensais.com.br`** e **`*.gastosmensais.com.br`** (os dois — o `www` está no
  curinga, o apex não);
- validade: **15 anos**.

A tela mostra **duas caixas de texto, e a chave privada some quando você sair dela.** Copie as
duas agora.

**Por que este certificado e não o Let's Encrypt:** ele vale 15 anos e não tem renovação, o que
elimina do deploy o certbot, o volume de desafio ACME, o `deploy-hook` que recarrega o nginx e a
dependência da porta 80 estar aberta a cada 60 dias. Ele **não** é confiável para um navegador, e
não precisa ser — quem o valida é a Cloudflare, e é exatamente isso que o modo Full (strict) faz.
A contrapartida é real e vale dizer em voz alta: **com este certificado o site só funciona atrás
da Cloudflare.** Desligar a nuvem laranja derruba o app com erro de certificado.

### 7.4 Instalar o certificado na VPS

Os arquivos vão para `/etc/ssl/cloudflare/`, com os nomes exatos abaixo — eles estão escritos
dentro de `deploy/proxy/nginx.conf`:

```bash
sudo install -d -m 0755 -o root -g root /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/gastosmensais.com.br.pem      # cole o Origin Certificate
sudo nano /etc/ssl/cloudflare/gastosmensais.com.br.key      # cole a Private Key
sudo chmod 0644 /etc/ssl/cloudflare/gastosmensais.com.br.pem
sudo chmod 0600 /etc/ssl/cloudflare/gastosmensais.com.br.key
sudo chown root:root /etc/ssl/cloudflare/*
```

Confira que colou o par certo — os dois `md5` abaixo têm de ser **iguais**. Um certificado com a
chave de outro é um erro que só aparece no `nginx -t`, com uma mensagem sobre incompatibilidade
que não diz qual dos dois arquivos está errado:

```bash
sudo openssl x509 -noout -modulus -in  /etc/ssl/cloudflare/gastosmensais.com.br.pem | openssl md5
sudo openssl rsa  -noout -modulus -in  /etc/ssl/cloudflare/gastosmensais.com.br.key | openssl md5
```

O diretório é montado **somente leitura** dentro do container `proxy` (`:ro` no
`docker-compose.yml`). O certificado nunca entra na imagem: segredo numa camada é segredo
publicado no dia em que a imagem for.

---

## 8. O `.env` e o e-mail

Estes dois passos já estão escritos no runbook, e é lá que eles são mantidos. **Vá, faça os dois,
e volte:**

1. **[Deploy.md, passo 1.3 — o `.env` da raiz](Deploy.md#13-o-env-da-raiz).** O arquivo inteiro,
   as duas chaves geradas por `openssl` e as três armadilhas silenciosas dele;
2. **[Deploy.md, passo 1.4 — o e-mail do domínio](Deploy.md#14-o-e-mail-do-domínio-só-no-servidor-e-uma-vez-só).**
   Resend, SPF, DKIM e o DMARC escrito à mão.

O `.env` mora em `/opt/gastosmensais/.env`, ao lado do `docker-compose.yml`, e **não** é
versionado. Um `API/.env` no servidor não é lido por ninguém.

---

## 9. Subir

```bash
cd /opt/gastosmensais
docker compose config | grep -E 'POSTGRES_|MAIL_|APP_URL|WEBAUTHN_|NODE_ENV|TZ:'
```

Leia a saída de verdade: é a única vez em que os valores aparecem lado a lado, já interpolados.
`NODE_ENV: production` e `TZ: America/Sao_Paulo` têm de aparecer mesmo sem estarem no `.env` —
eles vêm do compose.

```bash
docker compose build
```

O build do primeiro dia demora: são três imagens, dois `npm ci` e o webpack, no processador da
VPS. Se ele parecer travado, **abra uma segunda sessão SSH** e olhe `free -h` e
`top -b -n 1 | head -15` antes de matá-lo — carga perto de zero com o build parado é rede ou
espera, não lentidão. `docker compose build --progress=plain` mostra cada linha, e é o que se usa
quando algo dá errado.

Valide a configuração do nginx de borda **antes** de subir. O `proxy` é o único serviço que pode
falhar por um arquivo que o `build` aceitou sem reclamar:

```bash
docker compose run --rm --entrypoint nginx proxy -t
```

A saída certa termina em `syntax is ok` e `test is successful`. Um erro de certificado aqui é o
passo 7.4 malfeito.

```bash
docker compose up -d
docker compose ps
```

Espere os **quatro** serviços em `running`, com `db`, `api` e `proxy` em `healthy`.

**O log vai gritar `relation "RotineRuns" does not exist` a cada tick, e isso é normal agora.** O
banco existe e está vazio: subir e migrar são duas ações, de propósito. A mensagem para no passo
seguinte.

### A migration

```bash
docker compose exec api npm run migrate:prod
```

A linha que importa é `Batch 1 run: <N> migrations` — hoje são **28**. Ela **não** é a última da
saída: o `npm` costuma imprimir um `npm notice` sobre versão nova depois dela, e isso não é erro.

### Os quatro comandos que provam que a cadeia está de pé

```bash
docker compose exec api date                         # precisa dizer -03, não UTC
curl -s http://127.0.0.1/healthz                     # "ok" — o nginx de borda
curl -sI --resolve www.gastosmensais.com.br:80:127.0.0.1 \
     http://www.gastosmensais.com.br/ | head -1      # 301, o redirecionamento
curl -sk --resolve www.gastosmensais.com.br:443:127.0.0.1 \
     https://www.gastosmensais.com.br/api/Utils/Health
```

**O `--resolve` não é firula.** Um `curl https://127.0.0.1/` manda `127.0.0.1` como SNI e como
`Host`, não casa com o `server_name` do app e cai no `default_server`, que fecha a conexão sem
resposta (444) — você leria isso como "o app não subiu". O `--resolve` mantém o nome e força só o
destino. E o `-k` é porque o certificado de origem não é confiável para o `curl`, o que é o
esperado: quem o valida é a Cloudflare.

O `date` é a prova que não se pode pular: `TZ=America/Sao_Paulo` sem o pacote de fusos na imagem
**não dá erro** — a libc ignora o valor e o processo fica em UTC, com a variável ali,
aparentemente certa.

---

## 10. O backup, e a prova de que ele existe

O [passo 1.8 do Deploy.md](Deploy.md#18-o-backup-só-no-servidor), inteiro — o diretório, o timer
do systemd e a execução forçada.

E, no mesmo dia, o **ensaio de restore** do
[procedimento 5.1](Deploy.md#51-ensaio-geral-num-banco-descartável). Um backup nunca restaurado
não é backup, é um arquivo com nome tranquilizador.

---

## 11. Antes de chamar de no ar

A [lista de fumaça](Deploy.md#6-a-lista-de-fumaça) inteira. Ela não é cerimônia: a maioria
daqueles itens só falha em produção, e nenhum deles é `npm test`.

Os três que mais dependem do que você acabou de fazer nesta máquina:

- o cookie `token` chega com **`Secure`** e **`SameSite=Strict`**;
- `Strict-Transport-Security` vem nas respostas da API — é a prova de que o
  `X-Forwarded-Proto` atravessou os dois nginx;
- errar a senha do login **seis vezes** de um celular na rede móvel **não** bloqueia o login de
  outro dispositivo. Se bloquear, a API está vendo um IP só para todo mundo, e o lugar de olhar
  é o `set_real_ip_from` de `deploy/proxy/nginx.conf` — não o `trust proxy` do código.

---

## O que mudou em relação à máquina antiga

Para quem conheceu o servidor de casa, a lista curta do que deixou de existir:

| Antes | Agora |
| --- | --- |
| nginx instalado no host, configurado à mão em `/etc/nginx/` | container `proxy`, com a configuração versionada em `deploy/proxy/nginx.conf` |
| `deploy/nginx/host.conf.example`, uma cópia à mão para comparar com o servidor | não existe mais — não há dois lados para comparar |
| `web` publicando `127.0.0.1:8080` para o nginx do host alcançar | `web` sem porta nenhuma; quem publica 80 e 443 é o `proxy` |
| Let's Encrypt com renovação a cada 60 dias | certificado de origem da Cloudflare, 15 anos |
| Port forwarding no roteador, com a 443 bloqueada pelo provedor | IP público da VPS, 80 e 443 direto |
| DDNS atualizando o DNS quando o IP de casa mudava | IP fixo |
| A máquina dividida com o V3, o Ruah, o Obsidian e um MySQL | só este projeto |

O que **não** mudou, e continua valendo: `trust proxy` é **1**, o `X-Forwarded-For` é
**sobrescrito** na borda e **repassado** pelo `web`, e a cadeia inteira é
`usuário → Cloudflare → proxy → web → api`. O raciocínio está em `deploy/proxy/nginx.conf`, e é
o primeiro lugar a ler quando um número de IP parecer errado.
