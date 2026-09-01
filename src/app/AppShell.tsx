import { Navigate, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { isSignedOut, SessionProvider, useSessionQuery, useUnauthorizedRedirect } from "./session";
import { ApiUnauthorizedError } from "@/api/client";

/** Guard + chassi das rotas autenticadas. Quem decide se há sessão é o
 *  `getSelf`: 200 entra, 401 vai para o login. */
export function AppShell() {
    useUnauthorizedRedirect();
    const session = useSessionQuery();

    /* Saiu pelo menu (ou passou pelo login): o cookie pode continuar
       válido, mas a sessão do cliente não. Sem esta linha, "Sair" só
       recarregaria a mesma tela logada — não há rota de logout. */
    if (isSignedOut()) {
        return <Navigate to="/login" replace />;
    }

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
                {/* Abaixo de 900px a sidebar sai e a barra inferior
                    entra — as duas nunca aparecem juntas. */}
                <TabBar />
            </div>
        </SessionProvider>
    );
}
