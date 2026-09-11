#  ---------------------------------------------------------------------------------------
#  Estágio de build
#  ---------------------------------------------------------------------------------------
#
#  Base `bookworm-slim` (glibc), e não Alpine (musl): é a decisão que o `bcrypt` toma por nós.
#  Ele é um módulo nativo, compilado e não interpretado, e os prebuilds publicados são para
#  glibc — em Alpine não há binário pronto, o `npm ci` cai para compilar do zero e a imagem de
#  build passa a precisar de `python3`, `make` e `g++`. São dez minutos de CPU a cada
#  `docker compose build`, no mesmo processador que atende o app. A imagem fica maior que a
#  Alpine, e como a construção acontece no próprio servidor, sem registry, ninguém a transfere
#  pela rede.
FROM node:22-bookworm-slim AS build

WORKDIR /app

#  O manifesto antes do resto do código: as camadas do `npm ci` só se refazem quando uma
#  dependência muda, e não a cada edição de um `.ts`.
COPY package.json package-lock.json ./

RUN npm ci

COPY . .

#  `build:app` empacota o `index.ts` em `build/bundle.js`; `build:migrations` compila as
#  `migrations/*.ts` **e o `knexfile.ts`** para `build/` — é o que o `migrate:prod` do deploy
#  lê, já que aqui dentro não existe `ts-node` para carregar o `.ts`.
RUN npm run build

#  ---------------------------------------------------------------------------------------
#  Estágio de runtime
#  ---------------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

#  **`tzdata` explícito, e ele é a armadilha silenciosa desta imagem.** `TZ=America/Sao_Paulo`
#  sem o pacote de fusos instalado **não dá erro**: a libc não acha o arquivo do fuso e o
#  processo continua em UTC. E `Utils.currentMonth()` é o mês lido do relógio do processo,
#  valor padrão do saldo das contas, do relatório do mês e do extrato — das 21h às 23h59 do
#  último dia do mês, no horário de Brasília, as três rotas responderiam sobre o mês seguinte.
#  Nada dá erro, nada vai para o log, e o número na tela está errado.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

#  **O `webpack` não embute as dependências.** O `webpack.config.js` usa `nodeExternals()`,
#  então o `bundle.js` é só o código do projeto: todo `require` de `express`, `knex`, `pg` e
#  companhia continua apontando para `node_modules`. Um runtime que copiasse apenas o `build/`
#  morreria no primeiro `require`, e é por isso que as dependências são instaladas de novo
#  aqui — com `--omit=dev`, que é o que deixa `webpack`, `ts-loader`, `jest` e `tsx` de fora.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

#  Do estágio de build vem só o `build/`: o `bundle.js`, o `knexfile.js` e as migrations
#  compiladas. Nada de código-fonte, nada de configuração de build.
COPY --from=build /app/build ./build

#  Processo não-root. O usuário `node` já vem na imagem oficial, e nada aqui escreve em disco:
#  em produção o log vai para o stdout (`Utils/Logs.ts`) e não existe `.env` dentro da imagem.
USER node

EXPOSE 4000

#  **Forma exec, nunca `CMD npm start`.** A forma *shell* roda `/bin/sh -c`: o shell vira o
#  PID 1, recebe o `SIGTERM` do `docker stop` e **não o repassa** ao filho — o encerramento
#  ordenado do `index.ts` (motor de rotinas, requisições em voo, pool do Knex) só descobriria o
#  desligamento quando o `SIGKILL` chegasse dez segundos depois. Assim o node é o PID 1 e o
#  sinal cai direto no handler.
CMD ["node", "build/bundle.js"]
