#!/usr/bin/env bash
#
#  ---------------------------------------------------------------------------------------
#  O backup do banco — e o restore que prova que ele existe
#  ---------------------------------------------------------------------------------------
#
#  Roda `pg_dump -Fc` **de dentro do container do `db`** e grava o arquivo num diretório do
#  host. Agendado pelo `gastosmensais-backup.timer` (ao lado deste arquivo), uma vez por dia.
#
#  **De dentro do container porque não há outro caminho.** O serviço `db` do
#  `docker-compose.yml` sobe **sem `ports`**: o Postgres é alcançável apenas pela rede interna
#  do compose, e um `pg_dump -h localhost` do host não encontra banco nenhum. O cliente que
#  usamos é o que já veio na imagem `postgres:17-alpine`, na mesma versão do servidor — o que
#  também elimina a classe de falha em que o `pg_dump` do host é mais antigo que o servidor e
#  recusa a conexão.
#
#  **Nenhuma credencial mora neste arquivo, e nenhuma passa pela linha de comando.** O
#  `pg_dump` roda dentro do container e lê `POSTGRES_USER`, `POSTGRES_PASSWORD` e
#  `POSTGRES_DB` do ambiente que o próprio compose montou a partir do `.env` da raiz. Uma
#  senha escrita aqui seria uma senha versionada; uma senha passada como argumento apareceria
#  no `ps` de qualquer usuário da máquina.
#
#  **O destino fica fora do volume `pgdata`.** Um backup que mora dentro daquilo que ele
#  deveria substituir não é backup: o `docker volume rm` que apaga o banco apagaria os catorze
#  dumps junto. O diretório padrão é do host, e o volume do Postgres não o enxerga.
#
#  A dívida está registrada no plano da leva 8 e é consciente: **o backup fica no mesmo
#  disco**. Ele protege contra migration ruim, `delete` errado e corrupção lógica — que são as
#  causas prováveis. Não protege contra a perda do servidor.
#
#  ---------------------------------------------------------------------------------------
#  Por que `-Fc` (custom) e não SQL puro
#  ---------------------------------------------------------------------------------------
#
#  O dia em que este arquivo for usado, será provavelmente por causa de uma migration ruim ou
#  de um `delete` errado — não de um disco perdido. Nesses casos restaurar o banco inteiro é
#  desfazer o trabalho de todos os outros usuários junto.
#
#  O formato custom é um arquivo indexado, e é o único que o `pg_restore` sabe restaurar em
#  pedaços: `-t Expenses` traz uma tabela só, `-l`/`-L` escolhem o que entra, e `-j` restaura
#  em paralelo. Um `.sql` de `pg_dump -Fp` é um texto que só se aplica do começo ao fim. Ele
#  também já vem comprimido (zlib, nível 6) sem depender de um `gzip` no meio do pipe.
#
#  ---------------------------------------------------------------------------------------
#  O RESTORE — o procedimento, que é o critério de aceite desta etapa
#  ---------------------------------------------------------------------------------------
#
#  **Um backup nunca restaurado não é backup: é um arquivo com nome tranquilizador.** O texto
#  abaixo é a fonte do procedimento de restore do `1. Docs/Deploy.md`, e o resultado de cada
#  execução (a data, e se o `count(*)` bateu) é anotado lá.
#
#  Os comandos supõem que o `.env` da raiz está no ambiente do shell; dentro do container as
#  variáveis já existem, e é por isso que elas aparecem escapadas (`\$POSTGRES_USER`) — quem
#  as expande é o shell de dentro, não o de fora.
#
#  1. Ensaio geral, num banco descartável, **sem tocar no banco de produção**:
#
#       DUMP=$(ls -1t /var/backups/gastosmensais/*.dump | head -1)
#
#       docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" gastosmensais_restore_test'
#       docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d gastosmensais_restore_test --no-owner' < "$DUMP"
#       docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d gastosmensais_restore_test -c "select (select count(*) from \"Users\") as users, (select count(*) from \"Workspaces\") as workspaces, (select count(*) from \"Accounts\") as accounts, (select count(*) from \"Expenses\") as expenses, (select count(*) from \"ExpensePayments\") as pernas"'
#       docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" gastosmensais_restore_test'
#
#     O `--no-owner` existe porque o banco descartável é criado pelo usuário da aplicação e o
#     dump carrega os donos originais; sem ele o `pg_restore` sai com avisos de `ALTER OWNER`
#     que não são o que se está testando. Num restore de verdade, para o mesmo cluster e o
#     mesmo dono, ele não é usado.
#
#     O `pg_restore` pode terminar com avisos (extensões, comentários) e código de saída 0 —
#     o que prova o restore é o `count(*)` da linha seguinte bater com a produção, não a
#     ausência de texto em amarelo.
#
#  2. Restaurar **uma tabela só**, que é a razão de o formato ser `-Fc`. Restaurar por cima de
#     uma tabela que existe exige limpá-la antes — o `pg_restore` só faz `INSERT`/`COPY`, não
#     apaga nada:
#
#       docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t Expenses --data-only' < "$DUMP"
#
#     Para inspecionar o que existe dentro do arquivo antes de decidir:
#
#       docker compose exec -T db pg_restore --list < "$DUMP"
#
#  3. Restaurar o banco **inteiro**, que é o caso do desastre. O banco de produção é
#     recriado, e por isso a API desce antes e sobe depois — um `pg_restore` com a API
#     escrevendo por cima é a única forma de terminar com um banco pior do que o que se tinha:
#
#       docker compose stop api
#       docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
#       docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DUMP"
#       docker compose start api
#
#  ---------------------------------------------------------------------------------------
#  O que se pode mudar sem editar este arquivo
#  ---------------------------------------------------------------------------------------
#
#  As três variáveis abaixo existem para o **teste** do script (rodá-lo apontando para outro
#  diretório, ou para um compose de ensaio) não exigir uma cópia editada dele. O arquivo
#  versionado é o de produção, e os valores padrão são os de produção.
#
#    BACKUP_DIR         destino dos dumps            (padrão: /var/backups/gastosmensais)
#    BACKUP_KEEP_DAYS   retenção, em dias            (padrão: 14)
#    BACKUP_DB_SERVICE  nome do serviço no compose   (padrão: db)
#

set -euo pipefail

#  `pipefail` acima é metade da defesa contra o arquivo truncado. Sem ele, um `pg_dump` que
#  morre no meio de um pipe deixa o comando inteiro com código de saída 0, e o script grava o
#  pedaço que conseguiu sair como se fosse o backup do dia. A outra metade é o
#  `pg_restore --list` mais abaixo, que é o único jeito de saber que o arquivo está completo.

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gastosmensais}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_DB_SERVICE="${BACKUP_DB_SERVICE:-db}"

#  A raiz do repositório é o diretório acima deste arquivo, e é de lá que o `docker compose`
#  precisa rodar: é onde estão o `docker-compose.yml` e o `.env` que ele interpola. Resolver o
#  caminho a partir do próprio script (e não de um `WorkingDirectory` do systemd, nem do
#  diretório de quem chamou) é o que faz `./deploy/backup.sh`, `/opt/gastosmensais/deploy/backup.sh`
#  e o `cron` com `$PWD` em `/` significarem a mesma coisa.
REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

#  Os dumps nascem 0600 e o diretório se espera 0700. O arquivo é o banco inteiro em claro —
#  e-mails, hashes de senha e todo lançamento de todo usuário. Um `umask` herdado do cron
#  (0022, o mais comum) deixaria isso legível para qualquer conta da máquina.
umask 077

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { printf '%s  ERRO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }

#  ---------------------------------------------------------------------------------------
#  1. O destino
#  ---------------------------------------------------------------------------------------
#
#  **O diretório não é criado aqui, de propósito.** Um `mkdir -p` num script que roda como
#  root criaria `/var/backups/gastosmensais` com a dona e o modo que calhassem, em silêncio, e
#  o erro só apareceria no dia em que alguém fosse ler o dump. Pior: um erro de digitação no
#  `BACKUP_DIR` passaria a ser um diretório novo e vazio em vez de uma falha — e o backup
#  estaria indo, todo dia, para o lugar errado, com o timer verde.
#
#  A criação é um passo do deploy, uma vez só (está no `1. Docs/Deploy.md`):
#
#      sudo install -d -m 0700 -o root -g root /var/backups/gastosmensais
#
[ -d "$BACKUP_DIR" ] || die "o diretório de destino $BACKUP_DIR não existe. Crie-o uma vez, com: sudo install -d -m 0700 /var/backups/gastosmensais"
[ -w "$BACKUP_DIR" ] || die "sem permissão de escrita em $BACKUP_DIR (o timer roda como root; um cron de usuário não alcança este diretório)"

STAMP="$(date '+%Y-%m-%d_%H%M%S')"
DUMP_FILE="$BACKUP_DIR/gastosmensais-$STAMP.dump"

#  O dump é escrito num `.part` e só vira `.dump` depois de verificado. É o que garante que um
#  arquivo com o nome final é sempre um arquivo restaurável: o `ls -1t *.dump | head -1` do
#  procedimento de restore nunca pode pegar o pedaço de um dump interrompido às três da manhã.
#  O `mv` dentro do mesmo diretório é atômico.
PART_FILE="$DUMP_FILE.part"
trap 'rm -f -- "$PART_FILE"' EXIT

cd -- "$REPO_DIR"

#  ---------------------------------------------------------------------------------------
#  2. O dump
#  ---------------------------------------------------------------------------------------
#
#  `exec`, e não `run`: o container do `db` já está de pé, e um `docker compose run` subiria um
#  **segundo** Postgres, com o mesmo volume montado por dois processos. O efeito colateral é
#  bem-vindo — se o banco estiver parado, o `exec` falha aqui com "service db is not running" e
#  o script termina sem criar arquivo, em vez de gravar um dump vazio de um banco que não
#  respondeu.
#
#  `-T` desliga a alocação de TTY. Sem ele, o `docker compose` recusa rodar sem terminal
#  (que é exatamente o caso do timer do systemd) e, quando roda, contamina a saída binária com
#  a tradução de fim de linha do pseudo-terminal — um dump corrompido de um jeito que só
#  aparece no dia do restore.
#
#  O `sh -c '...'` em aspas simples é o que mantém a expansão do lado de dentro: as três
#  variáveis do Postgres existem no ambiente do container, e não no do host.
#
#  Sem `--no-owner` e sem `--no-privileges`: o dump guarda tudo que o banco tem, e quem decide
#  descartar dono e permissão é o **restore**, que sabe para onde está restaurando.
log "dump de $BACKUP_DB_SERVICE → $DUMP_FILE"

docker compose exec -T "$BACKUP_DB_SERVICE" \
	sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
	> "$PART_FILE" \
	|| die "o pg_dump falhou (código $?). Nenhum arquivo foi gravado."

#  ---------------------------------------------------------------------------------------
#  3. A verificação — a diferença entre um backup e um arquivo
#  ---------------------------------------------------------------------------------------
#
#  **Um backup que grava um arquivo truncado sem reclamar é pior que um que não grava**: o
#  segundo deixa o diretório vazio, que é visível; o primeiro deixa catorze arquivos de tamanho
#  plausível e a descoberta fica para o dia do desastre.
#
#  O `pg_restore --list` lê o índice do arquivo custom, que mora no **fim** dele: um dump
#  interrompido no meio falha aqui com "could not read from input file: end of file". É a
#  verificação mais barata que prova que o arquivo está inteiro, e ela roda dentro do mesmo
#  container — o host não precisa ter cliente do Postgres instalado.
#
#  O piso de tamanho é uma segunda rede, para o caso degenerado em que o `pg_dump` devolve
#  cabeçalho e nada mais. Ele não substitui o `--list`: o tamanho de um dump é plausível muito
#  antes de ele estar completo.
BYTES="$(wc -c < "$PART_FILE" | tr -d ' ')"
[ "$BYTES" -ge "${BACKUP_MIN_BYTES:-4096}" ] || die "o dump saiu com $BYTES bytes, menos que o mínimo plausível. Arquivo descartado."

docker compose exec -T "$BACKUP_DB_SERVICE" pg_restore --list < "$PART_FILE" > /dev/null \
	|| die "o dump gravou $BYTES bytes mas o pg_restore não consegue lê-lo — arquivo incompleto ou corrompido. Descartado."

mv -- "$PART_FILE" "$DUMP_FILE"
trap - EXIT
log "ok: $DUMP_FILE ($BYTES bytes)"

#  ---------------------------------------------------------------------------------------
#  4. A retenção
#  ---------------------------------------------------------------------------------------
#
#  **Ela só roda depois de o dump de hoje estar no lugar**, e não antes. Qualquer `die` acima
#  encerra o script aqui em cima: um dia em que o banco estiver fora do ar não pode ser o dia
#  em que o backup mais antigo é apagado.
#
#  `-mtime +N` é verdade quando a idade do arquivo, em períodos **inteiros** de 24 h, é maior
#  que N — ou seja, a partir de N+1 dias. Para uma retenção de 14 dias o número é 13: apaga o
#  que já tem 14 dias, e o diretório fica com os 14 dumps dos últimos 14 dias. Com `+14` a
#  retenção real seria de 15, e a diferença só apareceria para quem contasse os arquivos.
#
#  O `-name` restringe ao que este script escreve: um `.part` esquecido por uma queda de
#  energia não é apagado pela retenção, e fica visível no diretório como o que é — um dump que
#  não terminou.
PRUNE_DAYS="$((BACKUP_KEEP_DAYS - 1))"
REMOVED="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gastosmensais-*.dump' -mtime "+$PRUNE_DAYS" -print -delete | wc -l | tr -d ' ')"
log "retenção de $BACKUP_KEEP_DAYS dias: $REMOVED arquivo(s) apagado(s), $(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gastosmensais-*.dump' | wc -l | tr -d ' ') em disco"
