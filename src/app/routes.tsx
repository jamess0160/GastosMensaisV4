import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import styles from "./AppShell.module.css";
import { Login } from "@/pages/Login/Login";

/* As rotas espelham as 8 telas do layout (Layout/Hi-fi Desktop), mais
   as duas que o contrato pede e o layout não desenha: criar conta e
   perfil.

   Só o Login vem no pacote inicial. As telas de dentro chegam sob
   demanda, e é isso que impede que quem abre o app para entrar baixe o
   relatório, os gráficos e o formulário de gasto junto — as três coisas
   mais pesadas do projeto, e nenhuma delas é a tela de login. */

const SignUp = lazy(() => import("@/pages/SignUp/SignUp").then((m) => ({ default: m.SignUp })));
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

export const router = createBrowserRouter([
    { path: "/login", element: <Login /> },
    { path: "/cadastro", element: load(<SignUp />) },
    {
        path: "/",
        element: <AppShell />,
        children: [
            { index: true, element: load(<Dashboard />) },
            { path: "gastos", element: load(<Expenses />) },
            { path: "gastos/novo", element: load(<AddExpense />) },
            { path: "gastos/:idExpense/editar", element: load(<AddExpense />) },
            { path: "renda", element: load(<Income />) },
            { path: "contas", element: load(<Accounts />) },
            { path: "relatorio", element: load(<Report />) },
            { path: "personalizacao", element: load(<Settings />) },
            { path: "perfil", element: load(<Profile />) },
        ],
    },
]);
