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

/** PENDÊNCIA: o contrato não tem rota de logout, e o cookie é HttpOnly —
 *  o JS não consegue apagá-lo. Isto limpa o estado local e sai da área
 *  logada, mas a sessão no servidor só morre quando o Max-Age (24h)
 *  expira. Um `POST /Users/logout` que sobrescreva o cookie com
 *  Max-Age=0 resolve; até lá, é o melhor que dá para fazer no cliente. */
export function useSignOut() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    return () => {
        queryClient.clear();
        navigate("/login", { replace: true });
    };
}
