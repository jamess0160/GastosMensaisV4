# Frontend — Gastos mensais V4

React + Vite + TypeScript. Estilo em CSS Modules sobre os design tokens
exportados do Claude Design.

## Rodar

```bash
npm install
cp .env.example .env   # aponte VITE_API_PROXY_TARGET para a API local
npm run dev
```

O cookie de sessão é `HttpOnly` + `SameSite=Strict`: em dev, front e API
em portas diferentes são origens diferentes e o cookie não viaja. Por
isso o dev server faz proxy de `/api` (`server.proxy` em
[vite.config.ts](vite.config.ts)) — front e API ficam na mesma origem,
como em produção. **Não afrouxe o cookie para contornar isso.**

| Script | O que faz |
|---|---|
| `npm run dev` | Dev server em `localhost:5173` com proxy de `/api` |
| `npm run build` | Typecheck (`tsc -b`) + build de produção |
| `npm run typecheck` | Só o typecheck |
| `npm run format` | Prettier em todo o projeto (4 espaços) |
| `npm test` | Roda a suíte uma vez |
| `npm run test:watch` | Reexecuta a cada arquivo salvo |
| `npm run test:coverage` | Relatório de cobertura |

## Estrutura

```
Docs/          Contrato da API (fonte da verdade dos tipos)
Layout/        Export do Claude Design — Hi-fi Desktop e Mobile
src/api/       Um [Rota].connection.ts por rota, sobre axios
src/app/       Chassi: rotas, sidebar, sessão
src/lib/       Dinheiro, datas de calendário, DeviceKey
src/pages/     Uma pasta por tela (ver Convenções)
src/test/      Infra de teste: setup, servidor de mentira
src/styles/    tokens.css (transcrição do :root do layout) + global.css
src/types/     Tipos do contrato da API
src/ui/        Primitivas transcritas da folha compartilhada do layout
```

## Convenções

**Indentação de 4 espaços em todo o projeto.** Garantida por
[.editorconfig](.editorconfig) e [.prettierrc.json](.prettierrc.json);
`npm run format` aplica e `npm run format:check` verifica.

**Uma connection por rota da API.** Cada rota do contrato tem um arquivo
`[Rota].connection.ts`, em que a classe se chama sempre `Connection` e o
que se exporta é a constante `[Rota]Connection` — uma instância:

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

| Arquivo | Constante | Rota |
|---|---|---|
| `Users.connection.ts` | `UsersConnection` | `/Users` |
| `UsersAuth.connection.ts` | `UsersAuthConnection` | `/UsersAuth` |
| `Workspaces.connection.ts` | `WorkspacesConnection` | `/Workspaces` |
| `Accounts.connection.ts` | `AccountsConnection` | `/Accounts` |
| `PaymentMethods.connection.ts` | `PaymentMethodsConnection` | `/PaymentMethods` |
| `Categories.connection.ts` | `CategoriesConnection` | `/Categories` |
| `Persons.connection.ts` | `PersonsConnection` | `/Persons` |
| `Tags.connection.ts` | `TagsConnection` | `/Tags` |
| `Inflows.connection.ts` | `InflowsConnection` | `/Inflows` |
| `Expenses.connection.ts` | `ExpensesConnection` | `/Expenses` |
| `ExpensePayments.connection.ts` | `ExpensePaymentsConnection` | `/ExpensePayments` |
| `Budgets.connection.ts` | `BudgetsConnection` | `/Budgets` |
| `BudgetPeriods.connection.ts` | `BudgetPeriodsConnection` | `/BudgetPeriods` |
| `Utils.connection.ts` | `UtilsConnection` | `/Utils` |

**Os tipos do contrato vivem no namespace `ApiTypes`.** Todo o
`src/types/api.ts` é exportado por ele, então no consumo o tipo diz de
onde veio:

```ts
import type { ApiTypes } from "@/types/api";

async function list(query: ApiTypes.ExpenseListQuery): Promise<ApiTypes.Expense[]> { … }
```

O namespace é só de tipos — some inteiro na compilação e não deixa nada
no bundle.

**Uma pasta por página.** Cada tela vive em `src/pages/[Pagina]/` com a
mesma forma:

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

O controller não implementa nada: ele lista os eventos e exporta a
instância `[Pagina]Controller`. O corpo de cada evento é uma section.

```tsx
// controller.tsx
class Controller {
    readonly submitLogin = submitLogin;
    readonly signInWithBiometrics = signInWithBiometrics;
}

export const LoginController = new Controller();
```

As sections não conhecem React: recebem o `[Pagina]Context` que o
componente monta — estado atual e os verbos que mexem nele — e por isso
podem ser lidas e testadas sem montar a tela.

```tsx
// Login.tsx
const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void LoginController.submitLogin(context);
};
```

Páginas ainda não convertidas têm só `[Pagina].tsx` e `controller.tsx`:
`src/` e `sections/` aparecem quando houver estilo e eventos de verdade.

**Testes ficam em `tests/` ao lado do que testam.** Vitest, porque
reaproveita este mesmo `vite.config.ts` — o atalho `@/`, os CSS Modules e
o TypeScript funcionam no teste sem configuração paralela.

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

O que é coberto: `src/lib/` (dinheiro e datas), as `sections/` de cada
página e o interceptor de erro do client. O que **não** é: marcação,
snapshots e as primitivas visuais — teste de marcação quebra a cada
ajuste de layout e não pega bug.

Três decisões que valem saber:

- **O fuso é fixado em `America/Sao_Paulo`** em `src/test/setup.ts`. Numa
  máquina em UTC, todo teste de data passa e o bug aparece só em
  produção.
- **A rede é interceptada com MSW**, não mockando as connections. Assim o
  axios, o interceptor e o React Query rodam de verdade, e o teste cobre
  o caminho do `406` virar mensagem na tela. Requisição sem handler
  declarado **quebra o teste** em vez de sair para a rede.
- **Testes têm tsconfig próprio** (`tsconfig.test.json`). O do app não
  carrega os tipos do Node de propósito: um `process` disponível no
  código de tela é armadilha, porque ele não existe no navegador.

[src/api/client.ts](src/api/client.ts) tem a instância axios e o
interceptor que traduz status em erro tipado — `401` vira
`ApiUnauthorizedError` e dispara o evento que derruba a sessão, `406`
vira `ApiBusinessError` com a `msg` pronta para a tela, o resto vira
`ApiServerError`. As connections só falam de rotas e corpos.

`Layout/` e `Docs/` são material de referência, não código de produção —
ficam versionados porque são a fonte das conversões.

## Plano de desenvolvimento

As etapas até o MVP, o que fica de fora e por quê:
[Docs/Plano de Desenvolvimento.md](Docs/Plano%20de%20Desenvolvimento.md).

O que depende do backend, com proposta de contrato para cada item:
[Docs/Pendencias Backend.md](Docs/Pendencias%20Backend.md).

## Regras do domínio que o código assume

Estas vêm do contrato e mudam o resultado na tela. Leia
[Docs/API - Contrato Front-end.md](Docs/API%20-%20Contrato%20Front-end.md)
antes de mexer em qualquer agregação.

- **Datas de calendário são string.** `new Date("2026-05-05")` é UTC: em
  UTC-3 volta como 04/05. Use [src/lib/date.ts](src/lib/date.ts).
- **Rateio fecha na soma, em centavos.** Todo split é por valor absoluto,
  nunca porcentagem. Ver `splitClosesTotal` em
  [src/lib/money.ts](src/lib/money.ts).
- **Gasto tem dois rateios que não se cruzam:** `Payments` (financeiro,
  move saldo) e `Persons` (analítico). Duas formas + duas pessoas são
  2 + 2 linhas, nunca 4.
- **"Quanto entrou" filtra `Kind !== "transfer"`**, senão o mesmo dinheiro
  é contado a cada movimentação entre contas.
- **Gasto do mês soma pernas, não compras.** 600 em 6× custa 100 a agosto.
- **`Balance` e `Spent` seguem regras opostas:** saldo ignora pendente,
  orçamento conta pendente junto com pago.
- **Não existe header `Authorization`.** Só o cookie, e ele é HttpOnly.

## Estado da conversão

| Tela | Rota | Status |
|---|---|---|
| Login | `/login` | Convertida (senha + biometria) |
| Dashboard | `/` | A converter |
| Gastos | `/gastos` | A converter |
| Adicionar gasto | `/gastos/novo` | A converter |
| Renda | `/renda` | A converter |
| Contas | `/contas` | A converter |
| Relatório | `/relatorio` | A converter |
| Personalização | `/personalizacao` | A converter |

Layout mobile (`Layout/Hi-fi Mobile`) ainda não foi aplicado — as telas
convertidas são desktop-first.
