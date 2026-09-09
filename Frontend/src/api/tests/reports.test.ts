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
