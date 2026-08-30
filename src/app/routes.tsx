import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Login } from "@/pages/Login/Login";
import { Dashboard } from "@/pages/Dashboard/Dashboard";
import { Expenses } from "@/pages/Expenses/Expenses";
import { AddExpense } from "@/pages/AddExpense/AddExpense";
import { Income } from "@/pages/Income/Income";
import { Accounts } from "@/pages/Accounts/Accounts";
import { Report } from "@/pages/Report/Report";
import { Settings } from "@/pages/Settings/Settings";

/** As rotas espelham as 8 telas do layout (Layout/Hi-fi Desktop). */
export const router = createBrowserRouter([
    { path: "/login", element: <Login /> },
    {
        path: "/",
        element: <AppShell />,
        children: [
            { index: true, element: <Dashboard /> },
            { path: "gastos", element: <Expenses /> },
            { path: "gastos/novo", element: <AddExpense /> },
            { path: "renda", element: <Income /> },
            { path: "contas", element: <Accounts /> },
            { path: "relatorio", element: <Report /> },
            { path: "personalizacao", element: <Settings /> },
        ],
    },
]);
