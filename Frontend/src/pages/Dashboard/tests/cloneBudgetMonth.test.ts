import { HttpResponse, http as msw } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { cloneBudgetMonth, previousMonth } from "../sections/cloneBudgetMonth";
import { fakeDashboardContext } from "./context";

describe("previousMonth", () => {
    it("volta um mês", () => {
        expect(previousMonth("2026-10")).toBe("2026-09");
    });

    // A virada do ano é onde um `month - 1` escrito à mão erra, e o
    // rótulo do botão e o corpo da chamada saem DAQUI justamente para não
    // poderem discordar.
    it("atravessa a virada do ano", () => {
        expect(previousMonth("2026-01")).toBe("2025-12");
    });
});

describe("cloneBudgetMonth", () => {
    it("manda o mês anterior como From e o da tela como To", async () => {
        let body: Record<string, unknown> | undefined;
        server.use(
            msw.post("*/api/BudgetPeriods/clone", async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ msg: "ok", IdBudgetPeriods: [1, 2, 3] });
            }),
        );

        await cloneBudgetMonth(fakeDashboardContext(), "2026-10");

        // Dois meses e nada mais: não é o lote da Renda, porque as regras
        // do que vem e do que não vem são do servidor.
        expect(body).toEqual({ From: "2026-09", To: "2026-10" });
    });

    it("diz quantas fatias vieram, e de onde", async () => {
        const finishSubmit = vi.fn();
        server.use(
            msw.post("*/api/BudgetPeriods/clone", () =>
                HttpResponse.json({ msg: "ok", IdBudgetPeriods: [1, 2, 3] }),
            ),
        );

        await cloneBudgetMonth(fakeDashboardContext({ finishSubmit }), "2026-10");

        expect(finishSubmit).toHaveBeenCalledWith("3 fatias trazidas de Setembro · 2026.");
    });

    it("não pluraliza a fatia única", async () => {
        const finishSubmit = vi.fn();
        server.use(
            msw.post("*/api/BudgetPeriods/clone", () =>
                HttpResponse.json({ msg: "ok", IdBudgetPeriods: [7] }),
            ),
        );

        await cloneBudgetMonth(fakeDashboardContext({ finishSubmit }), "2026-10");

        expect(finishSubmit).toHaveBeenCalledWith("1 fatia trazida de Setembro · 2026.");
    });

    // Zero é o SEGUNDO clique num mês já clonado — resposta legítima, e
    // não erro. "0 fatias trazidas" deixaria o usuário procurando o que
    // deu errado.
    it("trata a lista vazia como aviso, não como falha", async () => {
        const finishSubmit = vi.fn();
        const failSubmit = vi.fn();
        server.use(
            msw.post("*/api/BudgetPeriods/clone", () =>
                HttpResponse.json({ msg: "Nada a copiar", IdBudgetPeriods: [] }),
            ),
        );

        await cloneBudgetMonth(fakeDashboardContext({ finishSubmit, failSubmit }), "2026-10");

        expect(failSubmit).not.toHaveBeenCalled();
        expect(finishSubmit).toHaveBeenCalledWith(
            "Nada a trazer de Setembro · 2026 — as fatias dele já estão neste mês.",
        );
    });

    // Mês FECHADO é 403, e a frase é a da API — a etapa 9 escolheu 403 e
    // não 406 para toda escrita em mês fechado: o papel está certo, o que
    // falta é o mês estar aberto.
    it("sobe a mensagem da API no mês fechado", async () => {
        const failSubmit = vi.fn();
        server.use(
            msw.post("*/api/BudgetPeriods/clone", () =>
                HttpResponse.json(
                    { msg: "Este mês já foi fechado e não aceita mais alterações no orçamento." },
                    { status: 403 },
                ),
            ),
        );

        await cloneBudgetMonth(fakeDashboardContext({ failSubmit }), "2026-10");

        expect(failSubmit).toHaveBeenCalledWith(
            "Este mês já foi fechado e não aceita mais alterações no orçamento.",
        );
    });
});
