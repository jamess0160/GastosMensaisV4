# CLAUDE.md — Frontend

Guia do lado cliente. React 18 + TypeScript + Vite, React Query, React Router, ECharts. Estilo
em CSS Modules sobre os design tokens exportados do Claude Design.

**As regras que valem para os dois lados estão no [CLAUDE.md da raiz](../CLAUDE.md)** e não se
repetem aqui: a convenção de commit, onde mora a documentação, as regras de dinheiro que o
cliente não pode contrariar e como funciona a sessão. Leia
[1. Docs/RoadMap MVP.md](../1.%20Docs/RoadMap%20MVP.md) antes de começar, e escreva o plano da
leva antes do código.

| Script | O que faz |
|---|---|
| `npm run dev` | Dev server em `localhost:5173` com proxy de `/api` |
| `npm run build` | Typecheck (`tsc -b`) + build de produção |
| `npm run typecheck` | Só o typecheck |
| `npm run format` | Prettier em todo o projeto (4 espaços) |
| `npm run format:check` | Verifica sem escrever |
| `npm test` | Roda a suíte uma vez |
| `npm run test:watch` | Reexecuta a cada arquivo salvo |
| `npm run test:coverage` | Relatório de cobertura |

## O proxy de `/api` em dev não é conveniência

O cookie de sessão é `HttpOnly` + `SameSite=Strict`. Em dev, front e API em portas diferentes
são **origens diferentes** e o cookie não viaja. Por isso o dev server faz proxy de `/api`
(`server.proxy` em [vite.config.ts](vite.config.ts)) — front e API ficam na mesma origem, como
em produção atrás do nginx. **Não afrouxe o cookie para contornar isso.**

Copie `.env.example` para `.env` e aponte `VITE_API_PROXY_TARGET` para a API local.

## Estrutura

```
Layout/        Export do Claude Design — Hi-fi Desktop e Mobile
src/api/       Um [Rota].connection.ts por rota, sobre axios
src/app/       Chassi: rotas, sidebar, tab bar, sessão, mês, telemetria
src/data/      Hooks de React Query: cadastros e movimento do mês
src/lib/       Dinheiro, datas, agregações, DeviceKey, rascunho, download, cooldown
src/pages/     Uma pasta por tela (ver Convenções)
src/test/      Infra de teste: setup, servidor de mentira
src/styles/    tokens.css (o :root do layout + a paleta escura) + global.css
src/types/     Tipos do contrato da API
src/ui/        Primitivas transcritas da folha compartilhada do layout
```

`Layout/` é material de referência, não código de produção — fica versionado porque é a fonte
das conversões.

**O tema é do aparelho, não da pessoa.** Claro, escuro e sistema — "sistema" é o padrão, e a
escolha mora no `localStorage`, não no banco: o celular à noite e o desktop no escritório são o
mesmo usuário com duas preferências, e assim o tema não custa coluna nem rota. Só os tokens que
mudam são redeclarados, em dois seletores — a media query com `:root:not([data-theme="light"])`,
que é o que deixa escolher **claro** num sistema escuro, e `:root[data-theme="dark"]`, para a
escolha explícita vencer. Duas consequências que não são opcionais: **cor literal em folha não
troca de tema**, então toda cor vem de token; e o `data-theme` é carimbado **antes da primeira
pintura** por `public/theme.js`, um `<script src>` bloqueante no `<head>` — arquivo e não script
inline porque a CSP do nginx é `script-src 'self'`, e um inline que funciona em `npm run dev` e
é bloqueado em produção é o flash branco aparecendo só no servidor. As cores de categoria
(`--cat-*`) e a marca **não invertem**: elas identificam, e o verde de "Casa" que muda com o tema
muda a leitura do gráfico.

**Os tipos da API vivem em `src/types/api.ts` e são escritos à mão.** Até 09/09/2026 eles eram
transcritos de um documento de contrato mantido no outro repositório; agora a fonte é
[o código da API](../API/), que está a uma pasta de distância. Ao mexer num tipo, confira a
rota em `API/routes/<Feature>/<Feature>.schema.ts` — é o Joi que roda de verdade.

**`src/data/` é a única camada que fala com o React Query.** As telas pedem
`useMonthLegs("2026-08")`, e não montam `useQuery` com array literal — chave de cache espalhada
pelas telas é como o cache passa a não invalidar. As chaves ficam em
[src/data/keys.ts](src/data/keys.ts) e a unidade de cache é o **mês**, que é a unidade de
navegação das telas: Início, Gastos e Relatório do mesmo mês compartilham a resposta. O
Relatório é a exceção deliberada — ele filtra por período, e usa `useRangeLegs(from, to)`, que
compõe os meses do intervalo reaproveitando o mesmo cache por chave.

## Convenções

**Indentação de 4 espaços em todo o projeto.** Garantida por [.editorconfig](.editorconfig) e
[.prettierrc.json](.prettierrc.json); `npm run format` aplica e `npm run format:check` verifica.

**`endOfLine: "auto"` não é preferência, é o que faz o `format:check` dizer a verdade aqui.** O
desenvolvimento é no Windows com `core.autocrlf=true`, então **o git entrega CRLF no checkout** —
e o padrão do prettier é `"lf"`. Com os dois juntos, todo arquivo que o git materializa de novo
reprova no `format:check` sem ter um único problema de formatação, e o gate passa a acusar
ruído: quem o vê falhar aprende a ignorá-lo, que é o pior estado possível para uma verificação.
O `"auto"` aceita o fim de linha que o arquivo já tem e só reclama de formatação de verdade.
**O que entra no repositório é LF de qualquer jeito**, porque o git normaliza na gravação — e os
arquivos que um programa do Linux lê (`*.sh`, `deploy/**`) são travados em LF pelo
[.gitattributes](../.gitattributes) da raiz, que explica esse caso por extenso.

**Uma connection por rota da API.** Cada rota tem um arquivo `[Rota].connection.ts`, em que a
classe se chama sempre `Connection` e o que se exporta é a constante `[Rota]Connection` — uma
instância:

```ts
// src/api/Expenses.connection.ts
class Connection {
    private readonly route = "/Expenses";
    // ...
}

export const ExpensesConnection = new Connection();
```

```ts
// no consumo
import { ExpensesConnection } from "@/api/Expenses.connection";

const gastos = await ExpensesConnection.list({ From: "2026-05-01", To: "2026-05-31" });
```

As quatorze de hoje: `Users`, `UsersAuth`, `Workspaces`, `Accounts`, `PaymentMethods`,
`Categories`, `Persons`, `Tags`, `Inflows`, `Expenses`, `ExpensePayments`, `BudgetPeriods`,
`Reports` e `Utils` — o nome do arquivo, o da constante e o da rota são sempre o mesmo nome.

**Os tipos do contrato vivem no namespace `ApiTypes`.** Todo o `src/types/api.ts` é exportado
por ele, então no consumo o tipo diz de onde veio:

```ts
import type { ApiTypes } from "@/types/api";

async function list(query: ApiTypes.ExpenseListQuery): Promise<ApiTypes.Expense[]> { … }
```

O namespace é só de tipos — some inteiro na compilação e não deixa nada no bundle.

**Uma pasta por página.** Cada tela vive em `src/pages/[Pagina]/` com a mesma forma:

```
src/pages/Login/
    Login.tsx              o componente: só marcação, estado e o contexto
    controller.tsx         DECLARA os eventos + o tipo do contexto
    src/
        styles.module.css  estilo da tela
    sections/
        submitLogin.ts     um arquivo por evento — aqui mora o código
        signInWithBiometrics.ts
        loadBiometricsAvailability.ts
```

O controller não implementa nada: ele lista os eventos e exporta a instância
`[Pagina]Controller`. O corpo de cada evento é uma section.

```tsx
// controller.tsx
class Controller {
    readonly submitLogin = submitLogin;
    readonly signInWithBiometrics = signInWithBiometrics;
}

export const LoginController = new Controller();
```

As sections não conhecem React: recebem o `[Pagina]Context` que o componente monta — estado
atual e os verbos que mexem nele — e por isso podem ser lidas e testadas sem montar a tela.

```tsx
// Login.tsx
const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void LoginController.submitLogin(context);
};
```

Páginas sem evento de verdade ficam só com `[Pagina].tsx` e `controller.tsx`. O Extrato era o
exemplo disso — leitura pura, em que navegar até o lançamento é do roteador e não um evento de
negócio — até a leva 9 pôr a quitação da fatura onde a fatura aparece; hoje ele tem `sections/`
como as outras.

**Testes ficam em `tests/` ao lado do que testam.** Vitest, porque reaproveita este mesmo
`vite.config.ts` — o atalho `@/`, os CSS Modules e o TypeScript funcionam no teste sem
configuração paralela.

```
src/lib/
    money.ts
    tests/money.test.ts
src/pages/Login/
    sections/submitLogin.ts
    tests/submitLogin.test.ts
    tests/context.ts           fábrica do LoginContext (não é teste)
src/test/
    setup.ts                   fuso fixado + ciclo do MSW
    server.ts                  servidor de mentira, sem handler por padrão
```

O que é coberto: `src/lib/` (dinheiro e datas), as `sections/` de cada página e o interceptor
de erro do client. O que **não** é: marcação, snapshots e as primitivas visuais — teste de
marcação quebra a cada ajuste de layout e não pega bug.

Três decisões de teste que valem saber:

- **O fuso é fixado em `America/Sao_Paulo`** em `src/test/setup.ts`. Numa máquina em UTC, todo
  teste de data passa e o bug aparece só em produção.
- **A rede é interceptada com MSW**, não mockando as connections. Assim o axios, o interceptor
  e o React Query rodam de verdade, e o teste cobre o caminho do `406` virar mensagem na tela.
  Requisição sem handler declarado **quebra o teste** em vez de sair para a rede.
- **Testes têm tsconfig próprio** (`tsconfig.test.json`). O do app não carrega os tipos do Node
  de propósito: um `process` disponível no código de tela é armadilha, porque ele não existe no
  navegador.

## O erro da API vira tipo antes de virar tela

[src/api/client.ts](src/api/client.ts) tem a instância axios e o interceptor que traduz status
em erro tipado — `401` vira `ApiUnauthorizedError`, `406` vira `ApiBusinessError` com a `msg`
pronta para a tela, o resto vira `ApiServerError`. As connections só falam de rotas e corpos.

**São dois `401`, e o corpo é o que os separa.** O middleware de sessão da API responde
`res.status(401).send()`, de corpo VAZIO: não veio cookie, ou o token não vale mais — esse é o
que dispara o `UNAUTHORIZED_EVENT` e derruba a sessão, com a frase "Sessão expirada.". As rotas
públicas de entrar (`POST /Users/login`, `POST /UsersAuth/authenticate`) respondem `401` **com
`msg`** para credencial recusada, e aí não há sessão a derrubar: o erro carrega a frase da API
("Login inválido") e nenhum evento é disparado. Tratar os dois igual é dizer "Sessão expirada."
a quem só errou a senha, e mandar a tela de login limpar o cache para navegar até ela mesma.

**O corpo do erro pode não ser JSON.** `GET /Reports/Export` é a única rota que responde um
arquivo, e o `responseType: "blob"` da connection vale também para a resposta de erro: um `406`
chega com a `msg` empacotada num `Blob`, e lê-la direto devolve `undefined` sem estourar nada —
o usuário veria o texto genérico no lugar da frase do servidor. Quem desempacota é o
`readErrorBody`, no interceptor, e é lá que ele fica para qualquer rota binária futura herdar.

## Estado das telas

| Tela | Rota | Estado |
|---|---|---|
| Login | `/login` | senha, biometria, convite de passkey, "manter conectado por 30 dias" |
| Criar conta | `/cadastro` | com login logo depois do `POST /Users` |
| Convite | `/convite/:hash` | pública |
| Esqueci a senha | `/esqueci-senha` | pública, com contador de 2 min no botão |
| Criar senha nova | `/recuperar-senha` | pública, lê o `?Token=` do link do e-mail |
| Confirmar e-mail | `/confirmar-email` | pública, confirma na montagem e oferece o reenvio |
| Início | `/` | indicadores vindos de `GET /Reports/Month`, com o bloco de orçamento **em leitura** — decidir é no Orçamento |
| Gastos | `/gastos` | lista **por perna** (a parcela, não a compra), detalhe, quitação da perna, série, cancelamento |
| Adicionar / editar gasto | `/gastos/novo`, `/gastos/:id/editar` | mesma página, em modal |
| Renda | `/renda` | entrada, transferência, e clonar o mês anterior |
| Orçamento | `/orcamento` | a renda do mês no topo, o rateio dela em fatias de pessoa e/ou categoria — com o comprometido de cada alvo **em prévia, antes de salvar** (`POST /BudgetPeriods/preview`) —, "distribuir o que sobra", o clone do mês anterior e o "fora do orçamento" |
| Contas | `/contas` | contas e cartões, com seletor de mês; o card do cartão mostra a fatura aberta e linka para ela |
| Fatura | `/contas/fatura/:idPaymentMethod` | um ciclo por vez, com navegação própria — a fatura **não é um mês** e não segue o seletor do chassi —, o que já está nela, o previsto, os próximos vencimentos e a quitação |
| Extrato | `/contas/extrato` | abertura → linhas assinadas → fechamento, por conta e por fatura, com a quitação no bloco do cartão |
| Relatório | `/relatorio` | linha, barras e donut em ECharts, com filtros próprios de período |
| Personalização | `/personalizacao` | categorias — reordenadas arrastando pela alça (↑ ↓ com foco nela, para o teclado) e com o grupo recolhido das arquivadas — e pessoas |
| Perfil | `/perfil` | dados, senha, passkeys e aparência (claro · escuro · sistema) |
| Espaço | `/espaco` | criar e editar o espaço, convidar e revogar convite, quem tem acesso — trocar papel, remover, sair e transferir a propriedade |

Todas respondem em 390px. Abaixo de 900px a sidebar sai e entra a barra inferior
([src/app/TabBar.tsx](src/app/TabBar.tsx)), com o botão central de lançar gasto — a navegação do
mobile é decisão do frontend, e a barra ganhou de gaveta porque as cinco áreas são de visita
constante.

**Os três botões que estavam rotulados "ainda sem API" foram ligados na leva 5.** "Conciliar
extrato" virou **"Extrato"** — a rota não importa arquivo do banco, não casa lançamento com
lançamento e não tem estado "conciliado", e chamá-la de conciliação prometeria o que a tela não
faz. Sobrou **um** desabilitado no produto: o "Continuar com Google" do login, que não tem
OAuth na API.

**A tela do Espaço é a única que muda de forma com o PAPEL de quem olha**, e a chave é uma só:
o `isOwner` da sessão ([src/app/session.tsx](src/app/session.tsx)), que sai do `IdOwnerUser` do
espaço atual. Renomear, convidar, listar convites e as ações de membro respondem 403 para quem
não é dono, e a tela não oferece um controle que sempre falharia. **Quem tem acesso** é a
exceção: a rota abre com `assertMember`, então todo mundo lê a lista — esconder de um editor
com quem ele divide o espaço só o deixaria sem saber a quem pedir uma permissão.

Duas guardas da tela são o inverso uma da outra, e vale saber por quê: as ações da linha do
membro são `isOwner && !IsSelf` (trocar papel, remover e transferir são só do dono, e nunca na
própria matrícula, que responde 406), enquanto **sair do espaço** é `!isOwner` — a rota exige
NÃO ser dono, porque um espaço sem dono não tem mais quem convide nem quem remova. É `IsSelf`
que diz qual linha é a sua, e ele vem da API: comparar e-mail no cliente seria comparar a coisa
errada.

**Transferir a propriedade é a única ação do app que muda o que o próprio usuário pode fazer**,
e é por isso que a section dela relê DUAS listas — a de membros e a de espaços. É o
`IdOwnerUser` da segunda que o `isOwner` lê: sem essa releitura a tela seguiria oferecendo o
bloco de convites a quem passou a levar 403 e escondendo o botão de sair de quem passou a poder
usá-lo. Fora isso não há cache a zerar, ao contrário de sair: o espaço é o mesmo, e contas,
lançamentos e saldos não mudaram.

E a tela tem um **terceiro estado**, além do dono e do membro: espaço nenhum. Quem sai do último
cai nele — sessão válida, sem espaço a que voltar —, e aí ela é só a criação de um, com a mesma
section que o seletor da sidebar usa.

**A faixa de "confirme seu e-mail" mora no chassi**, e não numa tela: o estado do e-mail é
informação da conta e vale em qualquer lugar do app. Ela não trava nada — quem não confirmou
continua usando tudo, porque bloquear o login é o que custa cadastro. A dispensa dela vive **em
memória** e volta no reload: um valor persistido no navegador discordaria do servidor sem que
nada acusasse.

**O re-aceite dos termos também mora no chassi**
([src/app/TermsGate.tsx](src/app/TermsGate.tsx)), e é o **oposto** da faixa acima: ele cobre o
app inteiro e as saídas são duas — aceitar, ou sair da conta. Não fecha no Escape, no clique
fora nem em botão nenhum, porque um "agora não" registraria que a pessoa usou o produto sob um
documento que ela não aceitou. Quem decide se o aceite está velho é a **API**, no `TermsOutdated`
do `getSelf`: o cliente não compara versão nenhuma — a que ele conhece é a `LEGAL_VERSION`, em
`"DD/MM/AAAA"`, e a do banco é `"YYYY-MM-DD"`, então a comparação ficaria do lado que não grava
nada e errar não quebraria teste. Depois do `POST /Users/acceptTerms` o que tira o modal da
frente é a **releitura da conta**, não um estado local dizendo "já cliquei".

**A exportação para Excel mora no chassi** ([src/app/exportSpreadsheet.ts](src/app/exportSpreadsheet.ts)),
porque sai de dois lugares com dois significados: a sidebar e o menu do mobile baixam o
**histórico inteiro** (é o que `GET /Reports/Export` faz sem `From`/`To`), e o botão do
Relatório baixa **o período que está na tela**. Nenhum dos dois abre um segundo seletor de
período — quem quer recortar vai ao Relatório, onde recortar é a tela. Nada de planilha montada
no navegador: o `.xlsx` vem pronto do servidor, que lê os números do mesmo lugar que a tela.

## Duas decisões que valem saber

**Os gráficos são ECharts, com importação modular.** `echarts/core` + Line/Bar/Pie +
Grid/Tooltip/Legend + `CanvasRenderer`, nunca o pacote inteiro: a tela do Relatório é `lazy`, e
importar tudo desfaria isso. O wrapper é [src/ui/echart.tsx](src/ui/echart.tsx), que inicializa,
observa o redimensionamento e destrói a instância. Os dois gráficos desenhados à mão em SVG que
existiam antes (`src/ui/charts.tsx`) saíram junto com essa mudança.

**A paleta de categorias foi reordenada, não trocada.** Os oito valores são os `--cat-*` do
layout. Na ordem original, verde e amarelo caem lado a lado e têm ΔE 4.2 para quem tem
protanopia — duas fatias vizinhas do donut ficariam indistinguíveis. Reordenados, o pior par
adjacente sobe para ΔE 18.1. O que a reordenação não resolve (amarelo e verde abaixo de 3:1 de
contraste, grafite quase acinzentado) é tratado por rótulo direto e visão em tabela: nenhum
gráfico identifica uma fatia só pela cor. O raciocínio inteiro está em
[src/lib/categoryColor.ts](src/lib/categoryColor.ts).

## As agregações moram num lugar só

[src/lib/aggregate.ts](src/lib/aggregate.ts), com teste, e não espalhadas pelos componentes. E
lembre do que o [CLAUDE.md da raiz](../CLAUDE.md#as-regras-de-dinheiro-que-os-dois-lados-assumem)
diz: `Balance` e `Spent` vêm prontos da API e **não se recalculam aqui**. O que o cliente agrega
são as **pernas** (`ExpensePayments`), que é a unidade de todo total de gasto.
