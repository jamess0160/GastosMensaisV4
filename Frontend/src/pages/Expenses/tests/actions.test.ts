import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { toggleLegPayment } from "../sections/toggleLegPayment";
import { cancelExpense } from "../sections/cancelExpense";
import { cancelSeries } from "../sections/cancelSeries";
import { updateSeries } from "../sections/updateSeries";
import { aSeriesDraft, fakeExpensesContext } from "./context";
import { aPayment } from "@/lib/tests/factories";

describe("toggleLegPayment", () => {
    it("quita a perna pela rota /pay, sem corpo", async () => {
        let body: string | null = null;
        server.use(
            msw.post("*/api/ExpensePayments/IdExpensePayment=4/pay", async ({ request }) => {
                body = await request.text();
                return HttpResponse.json({ msg: "Parcela quitada com sucesso" });
            }),
        );
        const context = fakeExpensesContext();

        await toggleLegPayment(context, aPayment({ IdExpensePayment: 4 }));

        // O instante do pagamento quem grava é o servidor.
        expect(body).toBe("");
        expect(context.finishSubmit).toHaveBeenCalledWith("Parcela quitada.");
    });

    it("desquita quando a perna já estava paga", async () => {
        server.use(
            msw.post("*/api/ExpensePayments/IdExpensePayment=4/unpay", () =>
                HttpResponse.json({ msg: "ok" }),
            ),
        );
        const context = fakeExpensesContext();

        await toggleLegPayment(context, aPayment({ IdExpensePayment: 4, Paid: true }));

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Parcela desquitada — o dinheiro voltou ao saldo.",
        );
    });

    it("na perna de CARTÃO chama charge, não pay — pay ali é 406", async () => {
        // Sem handler de /pay declarado: se ele fosse chamado, a
        // requisição quebraria o teste. É essa a garantia.
        let called = false;
        server.use(
            msw.post("*/api/ExpensePayments/IdExpensePayment=9/charge", () => {
                called = true;
                return HttpResponse.json({ msg: "Cobrança marcada como lançada na fatura" });
            }),
        );
        const context = fakeExpensesContext();

        await toggleLegPayment(context, aPayment({ IdExpensePayment: 9, Charged: false }));

        expect(called).toBe(true);
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Marcada como lançada na fatura — o saldo só desce quando a fatura for quitada.",
        );
    });

    it("desmarca a cobrança pelo uncharge", async () => {
        server.use(
            msw.post("*/api/ExpensePayments/IdExpensePayment=9/uncharge", () =>
                HttpResponse.json({ msg: "ok" }),
            ),
        );
        const context = fakeExpensesContext();

        await toggleLegPayment(
            context,
            aPayment({ IdExpensePayment: 9, Charged: true, ChargedAt: "2026-09-01T10:00:00Z" }),
        );

        expect(context.finishSubmit).toHaveBeenCalledWith("Cobrança desmarcada da fatura.");
    });

    it("mostra a msg da API quando a parcela já está quitada", async () => {
        server.use(
            msw.post("*/api/ExpensePayments/IdExpensePayment=4/pay", () =>
                HttpResponse.json({ msg: "Esta parcela já está quitada!" }, { status: 406 }),
            ),
        );
        const context = fakeExpensesContext();

        await toggleLegPayment(context, aPayment({ IdExpensePayment: 4 }));

        expect(context.failSubmit).toHaveBeenCalledWith("Esta parcela já está quitada!");
    });
});

describe("cancelExpense", () => {
    it("cancela e fecha o detalhe", async () => {
        server.use(
            msw.delete("*/api/Expenses/IdExpense=1", () =>
                HttpResponse.json({ msg: "Gasto cancelado com sucesso" }),
            ),
        );
        const context = fakeExpensesContext();

        await cancelExpense(context, 1);

        expect(context.closeDetail).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith("Gasto cancelado.");
    });

    it("mantém o detalhe aberto quando o gasto já estava cancelado", async () => {
        server.use(
            msw.delete("*/api/Expenses/IdExpense=1", () =>
                HttpResponse.json({ msg: "Gasto já está cancelado!" }, { status: 406 }),
            ),
        );
        const context = fakeExpensesContext();

        await cancelExpense(context, 1);

        expect(context.closeDetail).not.toHaveBeenCalled();
        expect(context.failSubmit).toHaveBeenCalledWith("Gasto já está cancelado!");
    });
});

describe("cancelSeries", () => {
    it("reporta quantas ocorrências foram canceladas", async () => {
        server.use(
            msw.delete("*/api/Expenses/IdExpense=1/series", () =>
                HttpResponse.json({ msg: "Série encerrada com sucesso", Canceled: 8 }),
            ),
        );
        const context = fakeExpensesContext();

        await cancelSeries(context, 1);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Série encerrada — 8 ocorrências canceladas.",
        );
    });

    it("concorda no singular quando cancela uma só", async () => {
        server.use(
            msw.delete("*/api/Expenses/IdExpense=1/series", () =>
                HttpResponse.json({ msg: "ok", Canceled: 1 }),
            ),
        );
        const context = fakeExpensesContext();

        await cancelSeries(context, 1);

        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Série encerrada — 1 ocorrência cancelada.",
        );
    });
});

describe("updateSeries", () => {
    it("NÃO manda ExpenseDate nem Payments — a rota não os aceita", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.put("*/api/Expenses/IdExpense=1/series", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok", Occurrences: 8 });
            }),
        );

        await updateSeries(fakeExpensesContext(), 1);

        // Mexer na data moveria cada ocorrência de mês; a forma de
        // pagamento se troca ocorrência a ocorrência.
        expect(body).not.toHaveProperty("ExpenseDate");
        expect(body).not.toHaveProperty("Payments");
        expect(body?.Description).toBe("Aluguel");
        expect(body?.TotalValue).toBe(2400);
    });

    it("reporta quantas ocorrências foram atingidas e fecha os dois painéis", async () => {
        server.use(
            msw.put("*/api/Expenses/IdExpense=1/series", () =>
                HttpResponse.json({ msg: "ok", Occurrences: 8 }),
            ),
        );
        const context = fakeExpensesContext();

        await updateSeries(context, 1);

        expect(context.closeSeriesForm).toHaveBeenCalledOnce();
        expect(context.closeDetail).toHaveBeenCalledOnce();
        expect(context.finishSubmit).toHaveBeenCalledWith(
            "Série atualizada — 8 ocorrências a partir desta.",
        );
    });

    it("recusa rateio que não fecha, antes de chamar a API", async () => {
        const context = fakeExpensesContext({
            seriesDraft: aSeriesDraft({
                TotalValue: 2400,
                persons: [{ id: 1, value: 1000 }],
            }),
        });

        await updateSeries(context, 1);

        expect(context.failSubmit).toHaveBeenCalledWith(
            "A soma do rateio entre pessoas precisa fechar com o total.",
        );
        expect(context.beginSubmit).not.toHaveBeenCalled();
    });
});
