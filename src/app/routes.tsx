import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import styles from "./AppShell.module.css";
import { MODAL_SCREENS } from "./screens";
import { Login } from "@/pages/Login/Login";

/* As rotas espelham as 8 telas do layout (Layout/Hi-fi Desktop), mais
   as duas que o contrato pede e o layout não desenha: criar conta e
   perfil.

   As telas de dentro do chassi vêm de `screens.tsx` e são montadas pelo
   AppShell, não por aqui: ver o cabeçalho de `modalRoute.tsx`. */

const SignUp = lazy(() => import("@/pages/SignUp/SignUp").then((m) => ({ default: m.SignUp })));

const load = (screen: ReactNode) => (
    <Suspense fallback={<div className={styles.center}>Carregando…</div>}>{screen}</Suspense>
);

export const router = createBrowserRouter([
    { path: "/login", element: <Login /> },
    { path: "/cadastro", element: load(<SignUp />) },
    {
        path: "/",
        element: <AppShell />,
        /* Só as MODAIS são rotas aqui. As telas são desenhadas pelo
           próprio chassi, a partir de `SHELL_SCREENS`, porque uma rota
           modal precisa mostrar a tela de onde foi aberta e não a que a
           URL diz — ver `modalRoute.tsx`. O `*` é o que faz qualquer
           URL de tela casar com o chassi; o que ela desenha é decidido
           lá dentro. */
        children: [...MODAL_SCREENS, { path: "*", element: null }],
    },
]);
