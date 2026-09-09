import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { sessionKeys, switchWorkspace } from "@/app/session";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/** Uma linha de `GET /Workspaces/getSelf`. */
const workspace = (IdWorkspace: number, Name: string, Current: boolean): ApiTypes.Workspace => ({
    IdWorkspace,
    Name,
    IdOwnerUser: 1,
    Current,
    CreatedAt: "2026-09-01T00:00:00.000Z",
    UpdatedAt: "2026-09-01T00:00:00.000Z",
});

/** A API de mentira: o `switch` move o `Current` e o `getSelf` responde a
 *  partir de onde a sessão está — como o servidor de verdade, que lê o
 *  workspace de dentro do token que acabou de ser reemitido. */
function fakeApi() {
    const state = { current: 1, reads: 0 };

    server.use(
        msw.post("*/api/Workspaces/switch", async ({ request }) => {
            const body = (await request.json()) as { IdWorkspace: number };
            state.current = body.IdWorkspace;
            return HttpResponse.json(workspace(state.current, "Ruah", true));
        }),
        msw.get("*/api/Workspaces/getSelf", () => {
            state.reads += 1;
            return HttpResponse.json([
                workspace(1, "Casa", state.current === 1),
                workspace(4, "Ruah", state.current === 4),
            ]);
        }),
    );

    return state;
}

describe("switchWorkspace", () => {
    /* A regressão que este teste tranca: trocar de espaço zera o cache SEM
       sair da tela, e um descarte que não rebusca deixa o chassi exibindo
       a lista antiga até o usuário dar F5 — que foi exatamente o que ele
       viu, com o nome do primeiro espaço numa sessão que já estava no
       segundo. */
    it("deixa a lista de espaços já rebuscada, com o Current no lugar novo", async () => {
        const api = fakeApi();
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        /* O mesmo par que o `SessionProvider` monta: a query da lista e um
           observer inscrito nela. Sem a inscrição a query não conta como
           ativa, e o teste passaria sem provar nada. */
        const observer = new QueryObserver<ApiTypes.Workspace[]>(queryClient, {
            queryKey: sessionKeys.workspaces,
            queryFn: () => WorkspacesConnection.getSelf(),
        });
        const unsubscribe = observer.subscribe(() => {});

        await observer.refetch();

        expect(api.reads).toBe(1);
        expect(observer.getCurrentResult().data?.find((item) => item.Current)?.Name).toBe("Casa");

        const switched = await switchWorkspace(queryClient, 4);

        expect(switched.IdWorkspace).toBe(4);

        /* Sem remount nenhum: a lista voltou do servidor por conta da
           troca, e o chassi já tem o nome certo para exibir. */
        expect(api.reads).toBe(2);
        expect(observer.getCurrentResult().data?.find((item) => item.Current)?.Name).toBe("Ruah");

        unsubscribe();
    });

    /* O guard do chassi lê "sem dados" como `isPending`: se a troca
       zerasse a conta junto, cada clique desmontaria o app inteiro num
       "Carregando…" para remontá-lo em seguida. E não há por que zerá-la —
       quem troca de espaço continua sendo a mesma pessoa. */
    it("não derruba a conta do usuário, que não é do espaço", async () => {
        fakeApi();
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        queryClient.setQueryData(sessionKeys.user, { IdUser: 1, Name: "Tiago" });

        await switchWorkspace(queryClient, 4);

        expect(queryClient.getQueryData(sessionKeys.user)).toEqual({ IdUser: 1, Name: "Tiago" });
    });
});
