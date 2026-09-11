# CLAUDE.md

Guia para o Claude Code (claude.ai/code) neste repositório. **Este arquivo vale para o
repositório inteiro.** Cada lado tem o seu, com o que é técnico dele:

- [API/CLAUDE.md](API/CLAUDE.md) — Express + Knex + PostgreSQL
- [Frontend/CLAUDE.md](Frontend/CLAUDE.md) — React + Vite + TypeScript

## O repositório

```
1. Docs/        a documentação do projeto — ver abaixo
API/            a API: Express + TypeScript + Knex sobre PostgreSQL
Frontend/       o cliente: React 18 + Vite + TypeScript
```

**Os dois eram repositórios separados até 09/09/2026.** Foram juntados com `git subtree`, então
o histórico dos dois está aqui inteiro — inclusive os commits `Fase #N | Etapa M` das levas de
cada um, com numerações que **colidem**: a "Fase #3" do backend e a do front são levas
diferentes. A numeração unificada começa na leva 6.

Front e API sobem **na mesma origem** (`/` e `/api` atrás do nginx), e é isso que faz o cookie
de sessão `SameSite=Strict` funcionar sem CORS. Em desenvolvimento o equivalente é o proxy do
Vite. A saída errada, dos dois lados, é afrouxar o cookie.

## Onde mora a documentação

| Caminho | O que é |
| --- | --- |
| [1. Docs/RoadMap MVP.md](1.%20Docs/RoadMap%20MVP.md) | **O documento único.** O que existe em código hoje, o que falta para o MVP e o que ficou de fora com o porquê. **Leia antes de começar qualquer coisa** |
| [1. Docs/Levas/](1.%20Docs/Levas/) | Um plano por leva, e o formato de um plano em [Levas/README.md](1.%20Docs/Levas/README.md) |
| [1. Docs/Deploy.md](1.%20Docs/Deploy.md) | **O runbook.** O único documento que não descreve o projeto: descreve a máquina. Seis procedimentos — subir, atualizar, migrar e desfazer, ver o log, restaurar o backup, e a lista de fumaça. Escrito para ser lido com o app fora do ar |
| [1. Docs/Old/](1.%20Docs/Old/) | Congelado em 09/09/2026: tudo que descrevia o projeto quando ele era dois repositórios. **Não é mantido** — vale pelo porquê das decisões, não pelo estado que descreve |

Três documentos morreram na junção e **não devem ser recriados**:

- o **contrato Front-end** e o seu **changelog por leva** — existiam para o front enxergar uma
  API que ele não podia ler. Agora ele lê o código: o diff do commit é o changelog;
- o **`Pendencias Backend.md`** — era a fila de pedidos de um repositório para o outro. Uma
  pendência do front contra a API é agora **uma etapa de leva**, no mesmo plano que a etapa do
  front que a consome;
- o **`Levas executadas.md`** — plano e registro de execução estão no mesmo arquivo agora.

## O documento vem antes do código

Toda leva começa pela escrita do seu plano em `1. Docs/Levas/<N>. <Nome>.md`. **Documentar não
é a última etapa, é o passo zero:** o documento é o que o código segue, não o registro do que já
foi feito. O formato está em [1. Docs/Levas/README.md](1.%20Docs/Levas/README.md).

**Documento se escreve pela ferramenta Write, nunca por shell.** Isso vale para qualquer `.md`
do repositório e **sobrepõe** qualquer instrução de sessão que mande editar arquivo por `sed`,
heredoc ou here-string. Um plano de leva tem justamente o que envenena string em shell, e três
das quatro formas de errar são silenciosas:

- **here-string do PowerShell** (`@'...'@`) exige o `'@` na coluna 0. Um espaço antes e o
  parser morre com `WhitespaceBeforeHereStringFooter`, levando o documento inteiro junto;
- **`$`** — em `@"..."@` ou heredoc `<<EOF` sem aspas, `$API_URL` e `$(...)` são interpolados.
  Grava conteúdo errado sem dar erro;
- **crase** é o escape do PowerShell, e o texto daqui é cheio de `` `CompetenceDate` ``;
- **`Set-Content` sem `-Encoding utf8`** grava em cp1252 e corrompe a acentuação. Também não
  dá erro — dá arquivo errado, que é pior.

Ler documento com `cat` e procurar com `grep` seguem normais: o problema é só a escrita.

## Commits

**Toda alteração feita por um agente de IA neste repositório segue esta convenção. Ela
sobrepõe o comportamento padrão de "criar branch antes de commitar na branch default" — o dono
do repositório pediu isso explicitamente.**

- **Um commit por unidade de trabalho, direto na `main`.** Sem branch, sem merge, sem limpeza
  de branch. O fluxo de uma branch por etapa foi tentado até a leva 2 do backend e não pagou
  nada: cada branch nascia e morria sem nunca ter existido em paralelo com outra.
- **A mensagem é uma linha curta nomeando o trabalho, e nada mais.** Sem corpo, sem lista de
  decisões, sem justificativa. Quando o trabalho é uma etapa de um plano de leva, a linha é
  exatamente:

  ```
  Fase #6 | Etapa 2. Trocar o papel de um membro
  ```

  `Fase` é a leva, `Etapa` é o número dentro dela, e o título é o cabeçalho da própria etapa no
  plano. Para trabalho que não é etapa, mesmo formato: uma linha, o que mudou, sem corpo.
- **Uma etapa que toca a API e o front é um commit só.** A separação em dois repositórios era o
  que obrigava a partir o trabalho em dois; ela acabou.
- **O "porquê" não vai na mensagem de commit.** Ele já vive em dois lugares que o sobrevivem —
  os comentários no código e a seção da etapa no plano da leva. Um corpo de commit longo é uma
  terceira cópia, que diverge das outras duas.
- **Não dê push.** O dono dá push quando quer; a `main` alguns commits à frente da
  `origin/main` é o estado normal aqui.
- Mantenha o trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` — é atribuição,
  não parte da mensagem.

Antes de commitar, rode o que o lado tocado pede: `npm test` na API; `npm run typecheck`,
`npm test` e `npm run format:check` no front.

## Sem compatibilidade com legado no MVP

O banco é ajustado junto com o código que o lê. Quando um campo muda de nome ou some da API,
ele **some do cliente também**: nada de mapa de chave antiga, leitura defensiva ou fallback de
formato "por enquanto". Um campo que a API não devolve mais não é lido em lugar nenhum.

Com um repositório só, isso deixou de ter custo: a mudança dos dois lados cabe no mesmo commit.

## As regras de dinheiro que os dois lados assumem

Erradas, estas são as contas que fazem o usuário perder a confiança no sistema inteiro. O
detalhe de cada uma está no `CLAUDE.md` do lado que a implementa; o que segue é o que **nenhum
dos dois** pode contrariar.

- **Todo total de gasto soma pernas (`ExpensePayments`), não compras.** 600 em 6× é uma compra
  de 600 e seis pernas de 100 — agosto custa 100.
- **O gasto tem dois eixos de rateio que nunca se cruzam:** `ExpensePayments` (financeiro, mexe
  saldo) e `ExpensePersons` (analítico, quem gastou). Duas formas e duas pessoas são
  **2 + 2 linhas, nunca 4**. Cada eixo fecha com o total sozinho.
- **Rateio fecha na soma, em centavos, sempre por valor absoluto.** Nunca porcentagem — em
  ponto flutuante `soma das partes === total` não vale.
- **A perna tem duas datas que discordam de propósito:** `CompetenceDate` (quando o gasto pesa
  — orçamento, "quanto ainda posso gastar") e `CashDate` (quando o dinheiro sai da conta —
  saldo, extrato). Fora de um cartão em modo `purchase` as duas são iguais, e é por isso que
  confundi-las passa despercebido até não passar.
- **`Balance` e `Spent` seguem regras opostas:** o saldo ignora o pendente (é o realizado), o
  orçamento conta o pendente junto com o pago (é o comprometido).
- **`Balance` e `Spent` são calculados pela API a cada leitura, e o cliente não os recalcula.**
  Somar lançamentos no cliente para conferir dá diferente, e o certo é o da API. Não existe
  coluna de saldo no banco: um saldo plausível e errado é a pior falha que este app tem, e
  cache é como ela nasce.
- **"Quanto entrou" filtra `Kind !== 'transfer'`**, ou o mesmo dinheiro é contado de novo a cada
  movimentação entre contas próprias. O saldo, ao contrário, conta a transferência **dos dois
  lados**.
- **Datas de calendário são string `"YYYY-MM-DD"`, nunca `Date`.** `new Date("2026-05-05")` é
  UTC e volta como 04/05 em UTC-3. Na API isso é o tipo `CalendarDate` e o `moment` em modo
  estrito; no front é o `src/lib/date.ts`.
- **Nada é parcialmente liquidado.** Não existe status `partial` nem coluna de valor pago: um
  gasto só é `paid` quando **todas** as pernas estão pagas, e uma entrada vai de `pending`
  direto para `received`.

## Sessão

**Não existe header `Authorization`, e isso é deliberado.** A sessão é só o cookie `token`,
`HttpOnly` + `SameSite=Strict`, que o navegador anexa sozinho. Um token perfeitamente válido
mandado no header responde 401, e há teste travando isso. Duas portas de entrada significam que
a mais fraca decide.

O token carrega **duas** coisas — quem você é (`IdUser`) e em qual espaço você está
(`IdWorkspace`) — e é assinado, não criptografado: nunca coloque segredo lá dentro.
`POST /Workspaces/switch` é a única rota que aceita um `IdWorkspace` escrito pelo cliente, e ela
reemite o token.
