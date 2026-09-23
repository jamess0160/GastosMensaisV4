import { HttpResponse, http as msw } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { ReportsConnection } from "@/api/Reports.connection";
import type { ApiTypes } from "@/types/api";

/* A rota que fecha a pendência 3 — e na forma preferida dela, a de
   tirar as regras de agregação do cliente, não a de só economizar
   requisição. */

const aMonthReport = (overrides: Partial<ApiTypes.MonthReport> = {}): ApiTypes.MonthReport => ({
    ReferenceMonth: "2026-09-01",
    OpeningBalance: 1500,
    Inflows: 3000,
    InflowsReceived: 3000,
    InflowsPending: 0,
    Expenses: 500,
    OverdueReceivable: 0,
    OverduePayable: 0,
    Available: 4000,
    CurrentBalance: 1300,
    OpenInvoices: 300,
    ...overrides,
});

describe("ReportsConnection.month", () => {
    it("manda o mês que a tela está exibindo", async () => {
        let url: URL | undefined;
        server.use(
            msw.get("*/api/Reports/Month", ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(aMonthReport({ ReferenceMonth: "2026-03-01" }));
            }),
        );

        const report = await ReportsConnection.month("2026-03");

        // O `ReferenceMonth` é opcional na rota e o default é o mês
        // corrente — omiti-lo devolveria setembro para quem olha março,
        // o mesmo erro que o mês de `GET /Accounts` já consertou.
        expect(url?.searchParams.get("ReferenceMonth")).toBe("2026-03");
        expect(report.ReferenceMonth).toBe("2026-03-01");
    });

    it("aceita ficar sem mês — aí quem escolhe é a API", async () => {
        let url: URL | undefined;
        server.use(
            msw.get("*/api/Reports/Month", ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(aMonthReport());
            }),
        );

        await ReportsConnection.month();

        expect(url?.searchParams.has("ReferenceMonth")).toBe(false);
    });

    it("devolve os nove números sem tocar em nenhum deles", async () => {
        server.use(
            msw.get("*/api/Reports/Month", () =>
                HttpResponse.json(
                    aMonthReport({ OverdueReceivable: 200, OverduePayable: 80, Available: 4120 }),
                ),
            ),
        );

        const report = await ReportsConnection.month("2026-09");

        // A conferência aqui é do CONTRATO, não da conta: o cliente não
        // refaz `OpeningBalance + Inflows − Expenses + vencidos` para ver
        // se fecha. Se divergir, é bug da API — e é lá que se conserta.
        expect(report.Available).toBe(4120);
        expect(report.CurrentBalance).toBe(1300);
        expect(report.OpenInvoices).toBe(300);
        expect(report.OverdueReceivable).toBe(200);
        expect(report.OverduePayable).toBe(80);
    });
});

/* ── O extrato ────────────────────────────────────────────── */

const aStatement = (
    overrides: Partial<ApiTypes.StatementReport> = {},
): ApiTypes.StatementReport => ({
    ReferenceMonth: "2026-09-01",
    Accounts: [
        {
            IdAccount: 1,
            Name: "Nubank",
            Active: true,
            OpeningBalance: 1000,
            ClosingBalance: 1300,
            Entries: [
                { Date: "2026-09-01", Kind: "opening", Description: "Saldo inicial", Value: 1000 },
                {
                    Date: "2026-09-05",
                    Kind: "inflow",
                    Description: "Salário",
                    Value: 3000,
                    IdInflow: 7,
                },
                {
                    Date: "2026-09-10",
                    Kind: "expense",
                    Description: "Mercado",
                    Value: -200,
                    IdExpense: 11,
                    IdExpensePayment: 22,
                },
                {
                    Date: "2026-09-15",
                    Kind: "invoice",
                    Description: "Fatura Visa",
                    Value: -2500,
                    IdPaymentMethod: 3,
                },
            ],
        },
    ],
    Cards: [],
    ...overrides,
});

describe("ReportsConnection.statement", () => {
    it("manda o mês que a tela está exibindo", async () => {
        let url: URL | undefined;
        server.use(
            msw.get("*/api/Reports/Statement", ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(aStatement({ ReferenceMonth: "2026-03-01" }));
            }),
        );

        const statement = await ReportsConnection.statement("2026-03");

        expect(url?.searchParams.get("ReferenceMonth")).toBe("2026-03");
        expect(statement.ReferenceMonth).toBe("2026-03-01");
    });

    it("devolve o fechamento que a API afirmou, e não a soma das linhas", async () => {
        server.use(msw.get("*/api/Reports/Statement", () => HttpResponse.json(aStatement())));

        const statement = await ReportsConnection.statement("2026-09");
        const account = statement.Accounts[0];

        /* A abertura mais a soma da coluna FECHA com o `ClosingBalance`
           — e é a API que garante isso, não o cliente. O teste confere o
           contrato; a tela exibe o número que veio. Somar para
           "conferir" na tela seria a segunda implementação da mesma
           pergunta, que é como duas telas passam a discordar. */
        const sum = account.Entries.filter((entry) => entry.Kind !== "opening").reduce(
            (total, entry) => total + entry.Value,
            0,
        );

        expect(account.OpeningBalance + sum).toBe(account.ClosingBalance);
    });

    it("carrega o id de volta ao lançamento em cada linha, conforme o Kind", async () => {
        server.use(msw.get("*/api/Reports/Statement", () => HttpResponse.json(aStatement())));

        const [opening, inflow, expense, invoice] = (await ReportsConnection.statement("2026-09"))
            .Accounts[0].Entries;

        // A abertura não é lançamento: não há para onde navegar.
        expect(opening.IdInflow).toBeUndefined();
        expect(inflow.IdInflow).toBe(7);
        expect(expense.IdExpense).toBe(11);
        // A fatura não tem lançamento único atrás dela — o destino do
        // clique é o CARTÃO, e é o `IdPaymentMethod` que leva lá.
        expect(invoice.IdExpense).toBeUndefined();
        expect(invoice.IdPaymentMethod).toBe(3);
    });
});
