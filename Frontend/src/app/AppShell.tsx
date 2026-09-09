import { Navigate, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MonthProvider } from "./monthScope";
import { ScreenRoutes, useScreenLocation } from "./modalRoute";
import { SessionProvider, useSessionQuery, useUnauthorizedRedirect } from "./session";
import { ApiUnauthorizedError } from "@/api/client";

/** Guard + chassi das rotas autenticadas. Quem decide se há sessão é o
 *  `getSelf`: 200 entra, 401 vai para o login. */
export function AppShell() {
    useUnauthorizedRedirect();
    const session = useSessionQuery();
    const screenAt = useScreenLocation();

    /* Quem decide se há sessão é o `getSelf`, e só ele: desde que
       `POST /Users/logout` existe, sair apaga o cookie de verdade e o
       401 chega aqui sozinho. Não há mais trava local a consultar. */
    if (session.isPending) {
        return <div className={styles.center}>Carregando…</div>;
    }

    if (session.isError) {
        if (session.error instanceof ApiUnauthorizedError) {
            return <Navigate to="/login" replace />;
        }
        return <div className={styles.center}>Não foi possível carregar sua conta.</div>;
    }

    return (
        <SessionProvider user={session.data}>
            <div className={styles.shell}>
                <Sidebar />
                <main className={styles.main}>
                    {/* O mês vive aqui e não dentro de cada tela: trocar
                        de página não pode zerar o mês que se está
                        olhando. */}
                    <MonthProvider>
                        {/* A tela, e depois o que estiver por cima
                            dela: o `<Outlet />` aqui só desenha rota
                            modal. Ver `modalRoute.tsx`. */}
                        <ScreenRoutes at={screenAt} />
                        <Outlet />
                    </MonthProvider>
                </main>
                {/* Abaixo de 900px a sidebar sai e a barra inferior
                    entra — as duas nunca aparecem juntas. */}
                <TabBar />
            </div>
        </SessionProvider>
    );
}
