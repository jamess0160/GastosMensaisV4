import { Navigate, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { SessionProvider, useSessionQuery, useUnauthorizedRedirect } from "./session";
import { ApiUnauthorizedError } from "@/api/client";

/** Guard + chassi das rotas autenticadas. Quem decide se há sessão é o
 *  `getSelf`: 200 entra, 401 vai para o login. */
export function AppShell() {
    useUnauthorizedRedirect();
    const session = useSessionQuery();

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
                    <Outlet />
                </main>
            </div>
        </SessionProvider>
    );
}
