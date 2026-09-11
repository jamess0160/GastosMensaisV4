#  ---------------------------------------------------------------------------------------
#  Estágio de build
#  ---------------------------------------------------------------------------------------
#
#  Mesma base da imagem da API (`node:22-bookworm-slim`) por um motivo de operação: a imagem é
#  construída no próprio servidor, e duas imagens sobre a mesma base compartilham as camadas
#  dela em disco e no cache do `docker compose build`. Aqui o glibc não é obrigatório — o front
#  não tem módulo nativo —, mas trocar de base custaria um download inteiro para não economizar
#  nada.
FROM node:22-bookworm-slim AS build

WORKDIR /app

#  O manifesto antes do resto do código: as camadas do `npm ci` só se refazem quando uma
#  dependência muda, e não a cada edição de um `.tsx`.
COPY package.json package-lock.json ./

#  `npm ci` completo, com as `devDependencies`: quem constrói o bundle é o `vite`, e quem roda
#  antes dele é o `tsc` — os dois são de desenvolvimento. Não existe `--omit=dev` aqui porque
#  nada deste estágio chega à imagem final: o que atravessa é o `dist/`, que é HTML, CSS e JS
#  estáticos.
RUN npm ci

COPY . .

#  `npm run build` é `tsc -b && vite build`: o typecheck roda **dentro** da imagem, então um
#  erro de tipo derruba o build em vez de virar deploy. A saída é o `dist/`, com os assets
#  nomeados por hash de conteúdo — que é o que torna a regra de cache imutável da config do
#  nginx correta e não otimista.
RUN npm run build

#  ---------------------------------------------------------------------------------------
#  Estágio de runtime
#  ---------------------------------------------------------------------------------------
#
#  **Aqui Alpine serve**, ao contrário da imagem da API: não há nada para compilar nem módulo
#  nativo para procurar prebuild — é um nginx servindo arquivo estático.
FROM nginx:alpine AS runtime

#  A configuração **versionada**: o fallback do SPA, a CSP, o cache, o gzip e o roteamento de
#  `/api`. Tudo que descreve o produto mora aqui, em diff revisável e idêntico em qualquer
#  máquina; o vhost do host fica com o que é do host — certificado, domínio e o encaminhamento
#  para a porta local.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

#  Só o `dist/`. Nada de `node_modules`, de código-fonte ou de `package.json` dentro da imagem
#  que fica exposta.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
