/* ════════════════════════════════════════════════════════════
   O tema ANTES da primeira pintura.

   POR QUE EXISTE. A escolha de tema mora no `localStorage`, e só
   JavaScript lê o `localStorage`. Se quem carimba o `data-theme` no
   `<html>` for o React, ele carimba DEPOIS do primeiro quadro — e
   quem escolheu escuro vê o app piscar branco em toda carga. Este
   arquivo roda antes de qualquer pixel: é um `<script>` clássico (sem
   `defer`, sem `type=module`) no `<head>`, então o parser para, ele
   executa, e só então o corpo é desenhado.

   POR QUE NÃO É INLINE no `index.html`, que seria uma requisição a
   menos. A CSP de `deploy/nginx.conf` diz `script-src 'self'`, sem
   `'unsafe-inline'` — e isso é deliberado, é o que transforma um XSS
   em erro de console. Um `<script>` escrito dentro do HTML seria
   BLOQUEADO em produção e funcionaria em desenvolvimento, que é a
   pior das duas: o flash branco apareceria só no servidor de verdade.
   A alternativa seria pendurar o hash sha256 deste código na CSP, em
   três lugares do nginx, para ele quebrar em silêncio no dia em que
   alguém mexesse numa vírgula aqui.

   Fica em `public/` porque precisa sair do build com ESTE nome: ele é
   referenciado pelo `index.html` e não passa pelo grafo de módulos.

   DUAS COISAS SE REPETEM em `src/app/theme.tsx`, que é quem manda no
   tema depois que o app sobe — a chave `gm.theme` e as duas cores de
   barra. Mudou aqui, muda lá.
   ════════════════════════════════════════════════════════════ */
(function () {
    try {
        var choice = window.localStorage.getItem("gm.theme");

        /* "sistema" NÃO carimba atributo: apagar o `data-theme` é o que
           devolve a palavra à media query de `tokens.css`. Só as duas
           escolhas explícitas viram atributo. */
        if (choice === "dark" || choice === "light") {
            document.documentElement.setAttribute("data-theme", choice);
        }

        var dark =
            choice === "dark" ||
            (choice !== "light" &&
                !!window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);

        /* A barra do navegador no telefone também é tema: laranja sobre
           um app escuro é uma faixa acesa no alto da tela. */
        var bar = document.querySelector('meta[name="theme-color"]');
        if (bar) bar.setAttribute("content", dark ? "#141312" : "#ff6a00");
    } catch (error) {
        /* `localStorage` LANÇA — não devolve `null` — em navegador com
           dados de site bloqueados. Sem este `catch`, o app inteiro
           morria antes do primeiro pixel por causa de uma preferência
           de aparência. Sem preferência legível, vale o sistema, que é
           o padrão de qualquer forma. */
    }
})();
