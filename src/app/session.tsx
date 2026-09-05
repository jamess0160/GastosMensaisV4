import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useSyncExternalStore,
    type ReactNode,
} from "react";
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
     *  `null` só no caso impossível de o usuário não ter nenhum. */
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

/** Em qual espaço a sessão está.
 *
 *  ⚠️ O CLIENTE NÃO TEM COMO SABER, e isto é o mais perto que se chega.
 *  `GET /Workspaces/getSelf` devolve a lista sem marcar o atual, o
 *  `IdWorkspace` vive dentro do token e o cookie é `HttpOnly`. É a
 *  pendência 19, e ela importa desde que o chassi passou a AFIRMAR o
 *  espaço em toda tela: um chute errado leva ao pior erro possível, que
 *  é lançar o mês inteiro no lugar errado.
 *
 *  O que se sabe com certeza é o que o `switch` respondeu — e é só isso
 *  que `remembered` carrega. Sem troca nenhuma nesta aba, sobra o
 *  primeiro da lista, que é o chute de sempre. Guardar o valor no
 *  navegador seria pior: ele pode discordar do cookie sem que nada
 *  acuse, e é justamente o tipo de leitura defensiva que este projeto
 *  não faz. */
export function currentWorkspace(
    workspaces: readonly ApiTypes.Workspace[],
    remembered: number | null,
): ApiTypes.Workspace | null {
    return (
        workspaces.find((workspace) => workspace.IdWorkspace === remembered) ??
        workspaces[0] ??
        null
    );
}

/* O que o último `switch` respondeu.
 *
 *  Mora FORA do React, e não no estado do provider, por um motivo
 *  concreto: a tela pública de aceite de convite troca de espaço com o
 *  chassi ainda desmontado — ela chama `join` e depois `switch` antes de
 *  navegar para dentro do app. Um estado do provider nasceria vazio
 *  justamente aí, e o usuário cairia no espaço antigo depois de aceitar,
 *  que é o bug mais provável desta entrega.
 *
 *  Some no reload, junto com a aba: um valor persistido pode discordar
 *  do cookie sem que nada acuse. */
let remembered: number | null = null;
const listeners = new Set<() => void>();

/** Só quem acabou de chamar `POST /Workspaces/switch` escreve aqui. */
export function rememberWorkspace(idWorkspace: number): void {
    remembered = idWorkspace;
    for (const listener of listeners) listener();
}

function subscribeToWorkspace(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const readRemembered = () => remembered;

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

    /* O `switch` limpa TODO o cache de query, então o espaço atual não
       pode morar lá — ele mora fora do React. Ver `rememberWorkspace`. */
    const rememberedId = useSyncExternalStore(subscribeToWorkspace, readRemembered, readRemembered);

    const value = useMemo<Session>(() => {
        const list = workspaces.data ?? [];
        const workspace = currentWorkspace(list, rememberedId);

        return {
            user,
            workspaces: list,
            workspace,
            isOwner: workspace?.IdOwnerUser === user.IdUser,
        };
    }, [user, workspaces.data, rememberedId]);

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
        queryClient.clear();
        // Depois do `clear`: isto vive fora do cache, e é o que o cliente
        // sabe de mais confiável sobre onde a sessão está.
        rememberWorkspace(workspace.IdWorkspace);
        return workspace;
    };
}
