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
const Accounts = lazy(() =>
    import("@/pages/Accounts/Accounts").then((m) => ({ default: m.Accounts })),
);
const Report = lazy(() => import("@/pages/Report/Report").then((m) => ({ default: m.Report })));
const Settings = lazy(() =>
    import("@/pages/Settings/Settings").then((m) => ({ default: m.Settings })),
);
const Profile = lazy(() => import("@/pages/Profile/Profile").then((m) => ({ default: m.Profile })));

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

/** As 7 telas do chassi — as 8 do layout menos o login, mais o perfil,
 *  que o contrato pede e o layout não desenha. */
export const SHELL_SCREENS: ScreenRoute[] = [
    { index: true, element: load(<Dashboard />) },
    { path: "gastos", element: load(<Expenses />) },
    { path: "renda", element: load(<Income />) },
    { path: "contas", element: load(<Accounts />) },
    { path: "relatorio", element: load(<Report />) },
    { path: "personalizacao", element: load(<Settings />) },
    { path: "perfil", element: load(<Profile />) },
];

/** Rotas MODAIS: têm URL própria, mas não são uma tela — desenham um
 *  painel por cima de uma das de cima. Ver `modalRoute.tsx`. */
export const MODAL_SCREENS: ScreenRoute[] = [
    { path: "gastos/novo", element: load(<AddExpense />) },
    { path: "gastos/:idExpense/editar", element: load(<AddExpense />) },
];
