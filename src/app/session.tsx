import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiUnauthorizedError, UNAUTHORIZED_EVENT } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/** A sessão não é lida do token — o cookie é HttpOnly. Quem diz se há
 *  sessão é `GET /Users/getSelf` responder 200 ou 401. */
interface Session {
    user: ApiTypes.User;
    workspaces: ApiTypes.Workspace[];
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
    const session = useContext(SessionContext);
    if (!session) throw new Error("useSession fora de <SessionProvider>");
    return session;
}

export const sessionKeys = {
    user: ["session", "user"] as const,
    workspaces: ["session", "workspaces"] as const,
};

export function useSessionQuery(): UseQueryResult<ApiTypes.User> {
    return useQuery({
        queryKey: sessionKeys.user,
        queryFn: () => UsersConnection.getSelf(),
        retry: (failureCount, error) =>
            !(error instanceof ApiUnauthorizedError) && failureCount < 2,
        staleTime: 5 * 60 * 1000,
    });
}

/** Envolve as rotas autenticadas. Assume que o guard já garantiu 200. */
export function SessionProvider({ user, children }: { user: ApiTypes.User; children: ReactNode }) {
    const workspaces = useQuery({
        queryKey: sessionKeys.workspaces,
        queryFn: () => WorkspacesConnection.getSelf(),
        staleTime: 5 * 60 * 1000,
    });

    return (
        <SessionContext.Provider value={{ user, workspaces: workspaces.data ?? [] }}>
            {children}
        </SessionContext.Provider>
    );
}

/** Um lugar só ouvindo o 401 do client: limpa o cache e manda ao login. */
export function useUnauthorizedRedirect() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        const onUnauthorized = () => {
            queryClient.clear();
            navigate("/login", { replace: true });
        };
        window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    }, [navigate, queryClient]);
}

/* ── Saída da sessão ────────────────────────────────────────── */

/** Sair de verdade.
 *
 *  O cookie `token` é `HttpOnly`: o JavaScript nunca conseguiu apagá-lo,
 *  e está certo que seja assim. Até a rota existir, o cliente contornava
 *  com uma trava no `localStorage` que fazia o app se COMPORTAR como
 *  deslogado enquanto a sessão continuava viva no servidor por 24h — em
 *  computador compartilhado, sair não saía. A trava saiu junto com o
 *  contorno: quem encerra a sessão agora é `POST /Users/logout`.
 *
 *  A ORDEM IMPORTA e o erro não pode prender ninguém. A rota é pública e
 *  responde 200 mesmo sem cookie, então não há caso em que o botão
 *  trave; falha de rede também não pode deixar o usuário na tela logada,
 *  e por isso limpar o cache e navegar acontecem de qualquer jeito. */
export function useSignOut() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    return () => {
        void (async () => {
            try {
                await UsersConnection.logout();
            } catch {
                /* Sem rede o cookie sobrevive até o `exp`, e não há o que
                   o cliente possa fazer sobre isso — o que ele não pode é
                   deixar o usuário preso na sessão anterior. */
            }
            queryClient.clear();
            navigate("/login", { replace: true });
        })();
    };
}
