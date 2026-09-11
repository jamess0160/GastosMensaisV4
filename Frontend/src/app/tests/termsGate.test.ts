import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { acceptTerms, termsGateCopy } from "@/app/TermsGate";
import { sessionKeys } from "@/app/session";
import { UsersConnection } from "@/api/Users.connection";
import { LEGAL_VERSION } from "@/pages/Legal/LegalLayout";
import type { ApiTypes } from "@/types/api";

/** Uma resposta de `GET /Users/getSelf`. */
const user = (TermsVersion: string | null, TermsOutdated: boolean): ApiTypes.User => ({
    IdUser: 1,
    Name: "Tiago",
    Email: "tiago@exemplo.com",
    Phone: 11999998888,
    EmailConfirmedAt: "2026-08-01T12:00:00.000Z",
    TermsAcceptedAt: TermsVersion ? "2026-08-01T00:00:00.000Z" : null,
    TermsVersion,
    TermsOutdated,
    LastLogin: "2026-09-10T12:00:00.000Z",
    TrialStartAt: null,
    TrialEndAt: null,
    Active: true,
    CreatedAt: "2026-08-01T00:00:00.000Z",
    UpdatedAt: "2026-09-10T12:00:00.000Z",
});

/** A API de mentira: o aceite carimba a versão do SERVIDOR — o corpo não
 *  tem onde mandar uma —, e o `getSelf` responde a partir do que ficou
 *  gravado, como o de verdade. */
function fakeApi() {
    const state = { version: "2026-09-10" as string | null, outdated: true, accepts: 0 };

    server.use(
        msw.post("*/api/Users/acceptTerms", () => {
            state.accepts += 1;
            state.version = "2026-09-11";
            state.outdated = false;
            return HttpResponse.json({ msg: "Termos aceitos com sucesso" });
        }),
        msw.get("*/api/Users/getSelf", () =>
            HttpResponse.json(user(state.version, state.outdated)),
        ),
    );

    return state;
}

describe("acceptTerms", () => {
    /* A regressão que este teste tranca: sem a releitura da conta, o
       modal continuaria na frente depois do 200 — ele sai pelo
       `TermsOutdated`, que é da API, e não por um estado local dizendo
       "já cliquei". */
    it("deixa a conta já relida, com o aceite em dia", async () => {
        const api = fakeApi();
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        /* O mesmo par que o chassi monta: a query da conta e um observer
           inscrito nela. Sem a inscrição a query não conta como ativa, e
           o `invalidateQueries` não rebuscaria nada. */
        const observer = new QueryObserver<ApiTypes.User>(queryClient, {
            queryKey: sessionKeys.user,
            queryFn: () => UsersConnection.getSelf(),
        });
        const unsubscribe = observer.subscribe(() => {});

        await observer.refetch();

        expect(observer.getCurrentResult().data?.TermsOutdated).toBe(true);

        await acceptTerms(queryClient);

        expect(api.accepts).toBe(1);
        expect(observer.getCurrentResult().data?.TermsOutdated).toBe(false);
        expect(observer.getCurrentResult().data?.TermsVersion).toBe("2026-09-11");

        unsubscribe();
    });

    /* O aceite não é do espaço e não moveu um centavo: zerar o cache
       inteiro faria o app rebuscar contas, gastos e saldos por causa de
       um clique que não mudou nenhum deles. */
    it("não derruba o resto do cache", async () => {
        fakeApi();
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        queryClient.setQueryData(sessionKeys.workspaces, [{ IdWorkspace: 1, Name: "Casa" }]);

        await acceptTerms(queryClient);

        expect(queryClient.getQueryData(sessionKeys.workspaces)).toEqual([
            { IdWorkspace: 1, Name: "Casa" },
        ]);
    });
});

describe("termsGateCopy", () => {
    it("com uma versão anterior gravada, diz que mudou e mostra as duas datas", () => {
        const copy = termsGateCopy("2026-09-10");

        expect(copy.title).toBe("Os termos mudaram");
        expect(copy.body).toContain("10/09/2026");
        expect(copy.body).toContain(LEGAL_VERSION);
    });

    /* Dizer "mudaram" a quem nunca aceitou nada seria mentir sobre o que
       aconteceu: para essa conta não houve mudança nenhuma — houve a
       chegada dos documentos, que não existiam quando ela nasceu. */
    it("sem aceite nenhum, não fala em mudança", () => {
        const copy = termsGateCopy(null);

        expect(copy.title).toBe("Aceite os termos para continuar");
        expect(copy.body).not.toContain("mudou");
        expect(copy.body).not.toContain("mudaram");
        expect(copy.body).toContain(LEGAL_VERSION);
    });
});
