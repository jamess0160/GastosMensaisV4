import { describe, expect, it } from "vitest";
import { cardCycleFromDates, DEFAULT_CLOSING_OFFSET_DAYS, invoiceDates } from "@/lib/card";

describe("invoiceDates", () => {
    it("fecha a fatura N dias ANTES do vencimento", () => {
        expect(invoiceDates("2026-09", 10, 7)).toEqual({
            closing: "2026-09-03",
            due: "2026-09-10",
        });
    });

    it("deixa o fechamento cair no mês anterior quando o vencimento é no começo", () => {
        // Vencendo dia 5 com folga de 7, a data do fechamento MUDA de mês
        // para mês — é a subtração que muda, não o cartão.
        expect(invoiceDates("2026-03", 5, 7).closing).toBe("2026-02-26");
        expect(invoiceDates("2026-04", 5, 7).closing).toBe("2026-03-29");
    });

    it("apara o vencimento no mês curto", () => {
        // Dia 31 em fevereiro é 28, e nunca 3 de março.
        expect(invoiceDates("2026-02", 31, 7)).toEqual({
            closing: "2026-02-21",
            due: "2026-02-28",
        });
    });

    it("usa a folga padrão quando o cartão não tem uma", () => {
        expect(invoiceDates("2026-09", 10, null).closing).toBe(
            invoiceDates("2026-09", 10, DEFAULT_CLOSING_OFFSET_DAYS).closing,
        );
    });
});

describe("cardCycleFromDates", () => {
    it("tira o dia do vencimento e a folga das duas datas", () => {
        expect(cardCycleFromDates("2026-08-29", "2026-09-05")).toEqual({
            DueDay: 5,
            ClosingOffsetDays: 7,
        });
    });

    it("é o caminho de volta de invoiceDates", () => {
        const { closing, due } = invoiceDates("2026-09", 10, 12);
        expect(cardCycleFromDates(closing, due)).toEqual({
            DueDay: 10,
            ClosingOffsetDays: 12,
        });
    });

    it("devolve folga não positiva quando as datas estão invertidas", () => {
        // Quem recusa é `saveCard`: aqui a conta é só a subtração.
        expect(cardCycleFromDates("2026-09-10", "2026-09-05").ClosingOffsetDays).toBe(-5);
    });
});
