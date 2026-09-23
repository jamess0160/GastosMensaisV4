import { lazy, Suspense, type ReactNode } from "react";
import styles from "./AppShell.module.css";

/* As telas de dentro do chassi, num lugar só.
 *
 *  Elas moram AQUI, e não em `routes.tsx`, porque são montadas de duas
 *  maneiras: pelo roteador, na URL de verdade, e pelo `AppShell`, quando
 *  uma rota modal precisa desenhar a tela de fundo. Uma lista só é o que
 *  garante que os dois caminhos mostrem a mesma coisa.
 *
 *  Só o Login vem no pacote inicial. As telas chegam sob demanda, e é
 *  isso que impede que quem abre o app para entrar baixe o relatório, os
 *  gráficos e o formulário de gasto junto — as três coisas mais pesadas
 *  do projeto, e nenhuma delas é a tela de login. */

const Dashboard = lazy(() =>
    import("@/pages/Dashboard/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Expenses = lazy(() =>
    import("@/pages/Expenses/Expenses").then((m) => ({ default: m.Expenses })),
);
const AddExpense = lazy(() =>
    import("@/pages/AddExpense/AddExpense").then((m) => ({ default: m.AddExpense })),
);
const Income = lazy(() => import("@/pages/Income/Income").then((m) => ({ default: m.Income })));
const Budget = lazy(() => import("@/pages/Budget/Budget").then((m) => ({ default: m.Budget })));
const Accounts = lazy(() =>
    import("@/pages/Accounts/Accounts").then((m) => ({ default: m.Accounts })),
);
const Statement = lazy(() =>
    import("@/pages/Statement/Statement").then((m) => ({ default: m.Statement })),
);
const Invoice = lazy(() => import("@/pages/Invoice/Invoice").then((m) => ({ default: m.Invoice })));
const Report = lazy(() => import("@/pages/Report/Report").then((m) => ({ default: m.Report })));
const Settings = lazy(() =>
    import("@/pages/Settings/Settings").then((m) => ({ default: m.Settings })),
);
const Profile = lazy(() => import("@/pages/Profile/Profile").then((m) => ({ default: m.Profile })));
const WorkspaceScreen = lazy(() =>
    import("@/pages/Workspace/Workspace").then((m) => ({ default: m.Workspace })),
);

/** O intervalo entre clicar no menu e a tela chegar. Fica em `center`,
 *  a mesma medida do carregamento da sessão, para que a troca de tela
 *  não pule. */
const load = (screen: ReactNode) => (
    <Suspense fallback={<div className={styles.center}>Carregando…</div>}>{screen}</Suspense>
);

export interface ScreenRoute {
    path?: string;
    index?: true;
    element: ReactNode;
}

/** As 11 telas do chassi — as 8 do layout menos o login, mais o perfil,
 *  o espaço, o extrato, a fatura e o orçamento, que a API pede e o
 *  layout não desenha. */
export const SHELL_SCREENS: ScreenRoute[] = [
    { index: true, element: load(<Dashboard />) },
    { path: "gastos", element: load(<Expenses />) },
    { path: "renda", element: load(<Income />) },
    /* O ORÇAMENTO é uma tela sua desde a leva 9, e não mais o painel do
       Início: repartir a renda do mês é um rateio inteiro — a renda no
       topo, uma linha por fatia com dois seletores e um valor, o botão
       de distribuir o que sobra e o "fora do orçamento" no fim —, e
       dentro do Início isso empurraria para baixo os indicadores e as
       três quebras. A divisão entre as duas é a que Contas tem com o
       Extrato: lá se olha, aqui se decide. */
    { path: "orcamento", element: load(<Budget />) },
    { path: "contas", element: load(<Accounts />) },
    /* O extrato é filho de Contas na URL porque é filho dela no
       produto: ele decompõe o saldo que aquela tela mostra somado, e o
       mês do chassi é o mesmo nas duas — o extrato de um mês e o saldo
       daquele mês têm que andar juntos. */
    { path: "contas/extrato", element: load(<Statement />) },
    /* A FATURA de um cartão. Também filha de Contas na URL — o cartão
       mora dentro da conta dele —, mas é a única tela do chassi que
       NÃO acompanha o mês: a fatura vai de fechamento a fechamento e
       quase nunca cabe num mês civil, e é ela mesma que navega por
       ciclo. Enquanto a fatura só existia dentro do Extrato, recortada
       pelo mês global, "e a fatura passada?" custava trocar o mês do
       Início, dos Gastos e do Relatório junto. */
    { path: "contas/fatura/:idPaymentMethod", element: load(<Invoice />) },
    { path: "relatorio", element: load(<Report />) },
    { path: "personalizacao", element: load(<Settings />) },
    { path: "perfil", element: load(<Profile />) },
    { path: "espaco", element: load(<WorkspaceScreen />) },
];

/** Rotas MODAIS: têm URL própria, mas não são uma tela — desenham um
 *  painel por cima de uma das de cima. Ver `modalRoute.tsx`. */
export const MODAL_SCREENS: ScreenRoute[] = [
    { path: "gastos/novo", element: load(<AddExpense />) },
    { path: "gastos/:idExpense/editar", element: load(<AddExpense />) },
];
