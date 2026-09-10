import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
    hashKey,
    useQuery,
    useQueryClient,
    type QueryClient,
    type UseQueryResult,
} from "@tanstack/react-query";
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
    /** A lista de espaços ainda não chegou.
     *
     *  Existe porque `workspace` é `null` em DOIS casos que pedem telas
     *  opostas: enquanto a lista carrega, e quando não há espaço nenhum.
     *  O segundo deixou de ser impossível quando sair do espaço passou a
     *  existir — quem sai do último fica exatamente assim, com a sessão
     *  válida e sem espaço a que voltar. Sem este campo, a tela do
     *  espaço teria que escolher entre piscar o formulário de criação em
     *  todo carregamento ou deixar quem saiu num "Carregando…" eterno. */
    workspacesPending: boolean;
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
            workspacesPending: workspaces.isPending,
            isOwner: workspace?.IdOwnerUser === user.IdUser,
        };
    }, [user, workspaces.data, workspaces.isPending]);

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
 *  vale mais, e por isso o cache é zerado inteiro em vez de invalidado
 *  seletivamente. Aqui não há nada que se aproveite.
 *
 *  O erro sobe para quem chamou: quem troca de espaço é uma tela, e é
 *  ela que tem onde mostrar a `msg` do 406.
 *
 *  Não depende do `SessionProvider`, de propósito: a tela pública de
 *  aceite de convite precisa dele com o chassi ainda desmontado. */
export async function switchWorkspace(
    queryClient: QueryClient,
    idWorkspace: number,
): Promise<ApiTypes.Workspace> {
    const workspace = await WorkspacesConnection.switch(idWorkspace);

    /* `reset`, e NÃO `clear` — e a diferença é a tela inteira.

       `clear` REMOVE as queries do cache, mas não avisa quem está
       montado: o observer de cada `useQuery` continua segurando o
       resultado anterior em memória, e a tela só volta ao normal num
       remount — na prática, só no F5. Trocar de espaço é o único lugar
       onde isso aparece, porque é o único que descarta o cache SEM sair
       da tela: nos outros (login, logout, 401) o que vem depois é um
       `navigate`, que desmonta tudo de qualquer jeito.

       `reset` zera as mesmas queries e REBUSCA as ativas, que é o que faz
       a tela toda — a lista de espaços inclusive, com o `Current` já no
       lugar novo — voltar do servidor sem F5. O `await` segura o
       "Trocando…" até os dados novos chegarem, em vez de piscar o espaço
       antigo.

       A CONTA FICA DE FORA, e é a única exceção: `GET /Users/getSelf` não
       tem nada de workspace dentro — quem troca de espaço continua sendo
       a mesma pessoa. Zerá-la seria pior do que inútil: o guard do chassi
       lê "sem dados" como `isPending`, então toda troca desmontaria o app
       inteiro num "Carregando…" para remontá-lo em seguida. */
    await queryClient.resetQueries({
        predicate: (query) => query.queryHash !== hashKey(sessionKeys.user),
    });

    return workspace;
}

export function useSwitchWorkspace() {
    const queryClient = useQueryClient();

    return (idWorkspace: number) => switchWorkspace(queryClient, idWorkspace);
}
