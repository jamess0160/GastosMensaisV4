import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { saveBudget } from "../sections/saveBudget";
import { removeBudgetPeriod } from "../sections/removeBudgetPeriod";
import { aBudgetDraft, fakeDashboardContext } from "./context";

describe("saveBudget · definir (POST /Budgets)", () => {
    it("manda ReferenceMonth como YYYY-MM", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Budgets", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudget: 1, IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        // Na resposta ele volta como "YYYY-MM-01", mas quem envia manda o
        // mês, não o dia 1.
        expect(body?.ReferenceMonth).toBe("2026-08");
        expect(body?.LimitValue).toBe(800);
        expect(body?.AlertPercent).toBe(80);
    });

    it("manda IdCategory, e NUNCA IdPerson junto — os dois são exclusivos", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Budgets", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudget: 1, IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        expect(body?.IdCategory).toBe(1);
        expect(body).not.toHaveProperty("IdPerson");
    });

    it("no teto de PESSOA manda IdPerson, e nenhuma categoria", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Budgets", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudget: 2, IdBudgetPeriod: 2 });
            }),
        );

        // O rascunho guarda os dois ids para o usuário poder trocar de
        // alvo sem perder o que escolheu; quem decide o que vai no corpo
        // é o `Scope`. Mandar os dois é 406.
        await saveBudget(
            fakeDashboardContext({
                budgetDraft: aBudgetDraft({ Scope: "person", IdPerson: 4, IdCategory: 1 }),
            }),
        );

        expect(body?.IdPerson).toBe(4);
        expect(body).not.toHaveProperty("IdCategory");
    });

    it("nunca manda Status — o mês nasce aberto", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/Budgets", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ IdBudget: 1, IdBudgetPeriod: 1 });
            }),
        );

        await saveBudget(fakeDashboardContext());

        expect(body).not.toHaveProperty("Status");
    });

    it("diz que a definição vale para o futuro", async () => {
        server.use(
            msw.post("*/api/Budgets", () => HttpResponse.json({ IdBudget: 1, IdBudgetPeriod: 1 })),
        );
        const context = fakeDashboardContext();

        await saveBudget(context);

        expect(context.finishSubmit).toHaveBeenCalledWith("Teto definido para este mês.");
    });
});

describe("saveBudget · corrigir (PUT /BudgetPeriods)", () => {
    it("usa a rota do período, não a da definição", async () => {
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

        // `ReferenceMonth` e `IdBudget` não são aceitos: mover o teto de
        // lugar é apagar este e cadastrar outro.
        expect(body).not.toHaveProperty("ReferenceMonth");
        expect(body).not.toHaveProperty("IdBudget");
        expect(body).not.toHaveProperty("IdCategory");
        expect(body).toEqual({ LimitValue: 800, AlertPercent: 80 });
    });

    it("deixa claro que a definição não muda", async () => {
        server.use(
            msw.put("*/api/BudgetPeriods/IdBudgetPeriod=5", () => HttpResponse.json({ msg: "ok" })),
        );
        const context = fakeDashboardContext({
            budgetDraft: aBudgetDraft({ IdBudgetPeriod: 5 }),
        });

        await saveBudget(context);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Teto deste mês corrigido — a definição segue como estava.",
        );
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
    it("apaga o mês e avisa que a definição sobrevive", async () => {
        server.use(
            msw.delete("*/api/BudgetPeriods/IdBudgetPeriod=5", () =>
                HttpResponse.json({ msg: "Orçamento do mês removido com sucesso" }),
            ),
        );
        const context = fakeDashboardContext();

        await removeBudgetPeriod(context, 5);

        // É o único delete físico do projeto — mas só do período: um
        // período é plano, não lançamento.
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Orçamento removido deste mês.",
        );
        expect(context.closeBudgetForm).toHaveBeenCalledOnce();
    });
});
