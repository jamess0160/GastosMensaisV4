import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveBudget } from "../sections/saveBudget";
import { removeBudgetPeriod } from "../sections/removeBudgetPeriod";
import { aBudgetDraft, fakeDashboardContext } from "./context";

describe("saveBudget · criar (POST /BudgetPeriods)", () => {
    it("manda ReferenceMonth como YYYY-MM", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        // Na resposta ele volta como "YYYY-MM-01", mas quem envia manda o
        // mês, não o dia 1.
        expect(body?.ReferenceMonth).toBe("2026-08");
        expect(body?.LimitValue).toBe(800);
        expect(body?.AlertPercent).toBe(80);
    });

    it("manda só o alvo que o formulário está editando", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        expect(body?.IdCategory).toBe(1);
        expect(body).not.toHaveProperty("IdPerson");
    });

    it("na fatia de PESSOA manda IdPerson, e nenhuma categoria", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudgetPeriod: 2 });
            }),
        );

        // O rascunho guarda os dois ids para o usuário poder trocar de
        // alvo sem perder o que escolheu; quem decide o que vai no corpo é
        // o `Scope` do rascunho — estado de TELA, não da API. Os dois
        // juntos já são um alvo válido, e é a etapa 12 que dá como montá-lo.
        await saveBudget(
            fakeDashboardContext({
                budgetDraft: aBudgetDraft({ Scope: "person", IdPerson: 4, IdCategory: 1 }),
            }),
        );

        expect(body?.IdPerson).toBe(4);
        expect(body).not.toHaveProperty("IdCategory");
    });

    it("nunca manda Status — a fatia nasce aberta", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        expect(body).not.toHaveProperty("Status");
    });

    it("confirma a fatia do mês", async () => {
        server.use(msw.post("*/api/BudgetPeriods", () => HttpResponse.json({ IdBudgetPeriod: 1 })));
        const context = fakeDashboardContext();

        await saveBudget(context);

        expect(context.finishSubmit).toHaveBeenCalledWith("Fatia definida para este mês.");
    });

    // Mês fechado não aceita escrita: a API responde 403 e a mensagem dela
    // é o que a tela mostra — não há estado local dizendo que o mês fechou.
    it("sobe a recusa do mês fechado como veio da API", async () => {
        server.use(
            msw.post("*/api/BudgetPeriods", () =>
                HttpResponse.json(
                    { msg: "Este mês já foi fechado e não aceita mais alterações no orçamento." },
                    { status: 403 },
                ),
            ),
        );
        const context = fakeDashboardContext();

        await saveBudget(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "Este mês já foi fechado e não aceita mais alterações no orçamento.",
        );
    });
});

describe("saveBudget · corrigir (PUT /BudgetPeriods)", () => {
    it("manda só o valor e o alerta", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/BudgetPeriods/IdBudgetPeriod=5", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok" });
            }),
        );

        await saveBudget(
            fakeDashboardContext({ budgetDraft: aBudgetDraft({ IdBudgetPeriod: 5 }) }),
        );

        // `ReferenceMonth` e o alvo não são aceitos: mover a fatia de
        // lugar é apagar esta e cadastrar outra.
        expect(body).not.toHaveProperty("ReferenceMonth");
        expect(body).not.toHaveProperty("IdCategory");
        expect(body).not.toHaveProperty("IdPerson");
        expect(body).toEqual({ LimitValue: 800, AlertPercent: 80 });
    });

    it("confirma a correção da fatia", async () => {
        server.use(
            msw.put("*/api/BudgetPeriods/IdBudgetPeriod=5", () => HttpResponse.json({ msg: "ok" })),
        );
        const context = fakeDashboardContext({
            budgetDraft: aBudgetDraft({ IdBudgetPeriod: 5 }),
        });

        await saveBudget(context);

        expect(context.finishSubmit).toHaveBeenCalledWith("Fatia deste mês corrigida.");
    });
});

describe("saveBudget · validação local", () => {
    it("recusa teto zero e manda remover o mês", async () => {
        // Teto zero é não ter teto — e a API responde 406.
        const context = fakeDashboardContext({ budgetDraft: aBudgetDraft({ LimitValue: 0 }) });

        await saveBudget(context);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "O teto precisa ser maior que zero. Para tirar o teto, remova o mês.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });

    it("recusa alerta fora de 1 a 100", async () => {
        const context = fakeDashboardContext({ budgetDraft: aBudgetDraft({ AlertPercent: 0 }) });

        await saveBudget(context);

        expect(context.failSubmit).toHaveBeenCalledWith("O alerta vai de 1% a 100%.");
    });

    it("cobra o alvo do escopo escolhido, e não a categoria sempre", async () => {
        const context = fakeDashboardContext({
            budgetDraft: aBudgetDraft({ Scope: "person", IdPerson: null }),
        });

        await saveBudget(context);

        expect(context.failSubmit).toHaveBeenCalledWith("Escolha a pessoa.");
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });
});

describe("removeBudgetPeriod", () => {
    it("apaga a fatia do mês", async () => {
        server.use(
            msw.delete("*/api/BudgetPeriods/IdBudgetPeriod=5", () =>
                HttpResponse.json({ msg: "Orçamento do mês removido com sucesso" }),
            ),
        );
        const context = fakeDashboardContext();

        await removeBudgetPeriod(context, 5);

        // É o único delete físico do projeto: uma fatia é plano, não
        // lançamento — e nada sobrevive a ela.
        expect(context.finishSubmit).toHaveBeenCalledWith("Orçamento removido deste mês.");
        expect(context.closeBudgetForm).toHaveBeenCalledOnce();
    });
});
