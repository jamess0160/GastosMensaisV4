#  ---------------------------------------------------------------------------------------
#  O proxy de borda — o nginx que termina o TLS
#  ---------------------------------------------------------------------------------------
#
#  **Este container substitui o nginx do host.** Até a migração para a VPS, quem terminava o
#  TLS era um nginx instalado na máquina, configurado à mão em `/etc/nginx/sites-available/` —
#  o único pedaço do deploy que o `git` não via. Ele existia por um motivo que acabou: a
#  máquina antiga era compartilhada com o V3 e com outros três serviços, e trocar aquele nginx
#  de lugar seria derrubar todos eles para subir este. Numa VPS que só hospeda este projeto,
#  esse motivo desapareceu e o que sobrou foi a desvantagem — configuração de produção fora do
#  controle de versão.
#
#  `nginx:alpine` e não `nginx` completo: aqui não há módulo nativo para compilar nem arquivo
#  estático para servir com tabela de mimetypes exótica. É TLS, cabeçalho e `proxy_pass`.
#
#  **O `http_realip_module` precisa existir nesta imagem**, e existe: a imagem oficial do nginx
#  o traz compilado por padrão. Sem ele o `set_real_ip_from` do `nginx.conf` não é uma diretiva
#  desconhecida que dá erro — é um módulo ausente que faz o `nginx -t` falhar na leitura, o que
#  pelo menos é barulhento. A conferência está na lista de fumaça do runbook.
FROM nginx:alpine

#  A configuração **versionada**, e este é o ganho inteiro de conteinerizar o proxy: o
#  certificado, o domínio, as faixas da Cloudflare e a cadeia de cabeçalhos passam a viver num
#  arquivo que o `git` vê, revisável em diff e idêntico em qualquer máquina. O que continua
#  fora da imagem é só o **segredo** — o par de certificado e chave, montado como volume em
#  tempo de execução pelo `docker-compose.yml`.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
