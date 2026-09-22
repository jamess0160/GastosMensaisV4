import { describe, expect, it } from "vitest";
import { goToCycle, goToOpenCycle } from "../sections/goToCycle";
import { anInvoice, fakeInvoiceContext } from "./context";

describe("goToCycle", () => {
    it("anda para o vencimento anterior que a API mandou", () => {
        const context = fakeInvoiceContext();

        goToCycle(context, anInvoice({ DueDate: "2026-10-04", PreviousDueDate: "2026-09-04" }), -1);

        // A data vem da RESPOSTA, não de uma conta feita aqui: quem sabe
        // qual é o ciclo vizinho é quem gravou o vencimento nas pernas.
        expect(context.showCycle).toHaveBeenCalledWith("2026-09-04");
    });

    it("anda para o vencimento seguinte", () => {
        const context = fakeInvoiceContext();

        goToCycle(
            context,
            anInvoice({
                DueDate: "2026-09-04",
                NextDueDate: "2026-10-04",
                OpenDueDate: "2026-11-04",
            }),
            1,
        );

        expect(context.showCycle).toHaveBeenCalledWith("2026-10-04");
    });

    it("NÃO anda na ponta", () => {
        const context = fakeInvoiceContext();

        goToCycle(context, anInvoice({ PreviousDueDate: null }), -1);

        // Sem esta guarda o `null` seria lido como "a aberta", e a seta
        // da ponta teleportaria o usuário para outro ciclo.
        expect(context.showCycle).not.toHaveBeenCalled();
    });

    it("guarda NULL ao chegar na fatura aberta pela seta", () => {
        const context = fakeInvoiceContext();

        goToCycle(
            context,
            anInvoice({
                DueDate: "2026-09-04",
                NextDueDate: "2026-10-04",
                OpenDueDate: "2026-10-04",
            }),
            1,
        );

        // `null` é a requisição SEM DueDate — a que pergunta qual fatura
        // está aberta HOJE. Guardar a data literal daria uma segunda
        // entrada de cache para a mesma fatura e congelaria "a aberta"
        // no vencimento de hoje.
        expect(context.showCycle).toHaveBeenCalledWith(null);
    });

    it("volta para a aberta pelo atalho do meio", () => {
        const context = fakeInvoiceContext({ due: "2026-08-04" });

        goToOpenCycle(context);

        expect(context.showCycle).toHaveBeenCalledWith(null);
    });
});
