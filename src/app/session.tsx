import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
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
    /** O espaço em que a sessão está — a raiz de tudo que a tela mostra.
     *  Quem o aponta é o `Current` que a API devolve. `null` enquanto a
     *  lista não chegou, e no caso impossível de nenhum vir marcado. */
    workspace: ApiTypes.Workspace | null;
    /** Este usuário é `owner` do espaço ATUAL?
     *
     *  As três rotas de gestão (`PUT /Workspaces`, `POST
     *  /Workspaces/invite`, `GET /Workspaces/invites`) respondem 403 para
     *  quem não é — a tela usa isto para não oferecer o caminho. */
    isOwner: boolean;
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

/** Em qual espaço a sessão está — e quem responde é a API.
 *
 *  `GET /Workspaces/getSelf` marca com `Current` o workspace do TOKEN
 *  que respondeu à requisição. O cliente não tem, e nunca teve, como
 *  chegar nisso sozinho: a seleção vive dentro do JWT e o cookie é
 *  `HttpOnly`. Enquanto o campo não existia, o chassi chutava o primeiro
 *  da lista e a tela AFIRMAVA um espaço enquanto os lançamentos iam para
 *  outro — era a pendência 19, e ela subiu em 08/09.
 *
 *  Sem `Current` em ninguém a resposta é `null`, e não o primeiro da
 *  lista: um espaço errado na tela é pior do que espaço nenhum. O caso
 *  não acontece pelo caminho normal — o login já seleciona um. */
export function currentWorkspace(
    workspaces: readonly ApiTypes.Workspace[],
): ApiTypes.Workspace | null {
    return workspaces.find((workspace) => workspace.Current) ?? null;
}

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

    const value = useMemo<Session>(() => {
        const list = workspaces.data ?? [];
        const workspace = currentWorkspace(list);

        return {
            user,
            workspaces: list,
            workspace,
            isOwner: workspace?.IdOwnerUser === user.IdUser,
        };
    }, [user, workspaces.data]);

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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

/** Trocar o espaço da sessão.
 *
 *  É a ÚNICA rota do contrato que recebe `IdWorkspace` do cliente — e o
 *  motivo é que ela REEMITE O COOKIE: o workspace vive dentro do token,
 *  não numa query string. Por isso ela mora aqui, ao lado do
 *  `useSignOut`: as duas reescrevem a sessão, e nenhuma das duas é de
 *  uma tela em particular.
 *
 *  A consequência é grande e fácil de esquecer: no instante em que o
 *  cookie novo chega, TODO cache de query passa a falar de outro
 *  workspace. Contas, categorias, gastos do mês, orçamentos — nada disso
 *  vale mais, e por isso o cache é descartado inteiro em vez de
 *  invalidado seletivamente. Aqui não há nada que se aproveite.
 *
 *  O erro sobe para quem chamou: quem troca de espaço é uma tela, e é
 *  ela que tem onde mostrar a `msg` do 406.
 *
 *  Não depende do `SessionProvider`, de propósito: a tela pública de
 *  aceite de convite precisa dele com o chassi ainda desmontado. */
export function useSwitchWorkspace() {
    const queryClient = useQueryClient();

    return async (idWorkspace: number): Promise<ApiTypes.Workspace> => {
        const workspace = await WorkspacesConnection.switch(idWorkspace);
        // O cache inteiro descartado inclui a lista de espaços, que volta
        // do servidor já com o `Current` no lugar novo — não há nada a
        // lembrar deste lado.
        queryClient.clear();
        return workspace;
    };
}
