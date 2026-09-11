import { useState } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MonthProvider } from "./monthScope";
import { TermsGate } from "./TermsGate";
import { ScreenRoutes, useScreenLocation } from "./modalRoute";
import { SessionProvider, useSessionQuery, useUnauthorizedRedirect } from "./session";
import { ApiUnauthorizedError } from "@/api/client";

/** Guard + chassi das rotas autenticadas. Quem decide se há sessão é o
 *  `getSelf`: 200 entra, 401 vai para o login. */
export function AppShell() {
    useUnauthorizedRedirect();
    const session = useSessionQuery();
    const screenAt = useScreenLocation();

    /* A dispensa da faixa vive EM MEMÓRIA, e volta no reload.
    
       É o comportamento certo para algo que ainda não foi feito: um
       `localStorage` aqui seria mais um valor persistido no navegador
       que discorda do servidor sem que nada acuse — quem confirmasse
       em outro aparelho continuaria vendo a faixa dispensada aqui, ou
       o contrário. */
    const [dismissed, setDismissed] = useState(false);

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
                    {/* A faixa mora NO CHASSI e não numa tela: o estado do
                        e-mail é informação da conta, e vale em qualquer
                        lugar do app.

                        Ela não trava nada — nenhuma tela ganha bloqueio
                        por e-mail não confirmado. Bloquear o login é o
                        que custa cadastro, porque quem não recebe o
                        e-mail fica do lado de fora dependendo de o
                        reenvio funcionar. */}
                    {session.data.EmailConfirmedAt === null && !dismissed && (
                        <div className={styles.confirmBanner}>
                            <span>
                                Confirme o e-mail <b>{session.data.Email}</b> para garantir a
                                recuperação de senha.
                            </span>
                            <span className={styles.confirmActions}>
                                <Link to="/perfil" className={styles.confirmLink}>
                                    Resolver no perfil
                                </Link>
                                <button
                                    type="button"
                                    className={styles.confirmDismiss}
                                    onClick={() => setDismissed(true)}
                                    aria-label="Dispensar aviso"
                                >
                                    Agora não
                                </button>
                            </span>
                        </div>
                    )}

                    {/* O re-aceite dos termos, e ele é o OPOSTO da
                        faixa acima: cobre o app inteiro e as saídas
                        são duas — aceitar, ou sair da conta.

                        Ele vem ANTES do `MonthProvider` porque não é
                        de uma tela nem de um mês: é a permissão de
                        continuar prestando o serviço sob o texto novo.
                        Em dia, não desenha nada. */}
                    <TermsGate user={session.data} />

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
