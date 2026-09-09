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
src/lib/       Dinheiro, datas, agregações, DeviceKey, rascunho
src/pages/     Uma pasta por tela (ver Convenções)
src/test/      Infra de teste: setup, servidor de mentira
src/styles/    tokens.css (transcrição do :root do layout) + global.css
src/types/     Tipos do contrato da API
src/ui/        Primitivas transcritas da folha compartilhada do layout
```

`Layout/` é material de referência, não código de produção — fica versionado porque é a fonte
das conversões.

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

As quinze de hoje: `Users`, `UsersAuth`, `Workspaces`, `Accounts`, `PaymentMethods`,
`Categories`, `Persons`, `Tags`, `Inflows`, `Expenses`, `ExpensePayments`, `Budgets`,
`BudgetPeriods`, `Reports` e `Utils` — o nome do arquivo, o da constante e o da rota são sempre
o mesmo nome.

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

Páginas sem evento de verdade ficam só com `[Pagina].tsx` e `controller.tsx` — hoje só o
Relatório, que é leitura e filtro.

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
em erro tipado — `401` vira `ApiUnauthorizedError` e dispara o evento que derruba a sessão,
`406` vira `ApiBusinessError` com a `msg` pronta para a tela, o resto vira `ApiServerError`. As
connections só falam de rotas e corpos.

## Estado das telas

| Tela | Rota | Estado |
|---|---|---|
| Login | `/login` | senha, biometria, convite de passkey |
| Criar conta | `/cadastro` | com login logo depois do `POST /Users` |
| Convite | `/convite/:hash` | pública |
| Início | `/` | indicadores vindos de `GET /Reports/Month`, com o bloco de orçamentos |
| Gastos | `/gastos` | lista, detalhe, quitação da perna, série, cancelamento |
| Adicionar / editar gasto | `/gastos/novo`, `/gastos/:id/editar` | mesma página, em modal |
| Renda | `/renda` | entrada, transferência, e clonar o mês anterior |
| Contas | `/contas` | contas e cartões, quitação da fatura, com seletor de mês |
| Relatório | `/relatorio` | linha, barras e donut em ECharts, com filtros próprios de período |
| Personalização | `/personalizacao` | categorias e pessoas |
| Perfil | `/perfil` | dados, senha, passkeys |
| Espaço | `/espaco` | criar e editar o espaço, convidar e revogar convite |

Todas respondem em 390px. Abaixo de 900px a sidebar sai e entra a barra inferior
([src/app/TabBar.tsx](src/app/TabBar.tsx)), com o botão central de lançar gasto — a navegação do
mobile é decisão do frontend, e a barra ganhou de gaveta porque as cinco áreas são de visita
constante.

**Três botões estão na tela rotulados como "ainda sem API" e a API já existe** desde 07/09:
conciliar extrato, exportar para Excel e esqueci minha senha. São as etapas abertas da leva 5 —
ver a [fila do roadmap](../1.%20Docs/RoadMap%20MVP.md#a-fila-até-o-mvp).

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
