import { describe, expect, it } from "vitest";
import {
    cardCycleFromDates,
    DEFAULT_CLOSING_OFFSET_DAYS,
    invoiceDates,
    invoiceOf,
} from "@/lib/card";
import type { ApiTypes } from "@/types/api";

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

/* ── A fatura ─────────────────────────────────────────────── */

/** Um cartão em modo `purchase` que vence dia 04 — o modo PADRÃO do
 *  servidor, e aquele em que competência e vencimento divergem. */
const card: ApiTypes.PaymentMethod = {
    IdPaymentMethod: 7,
    IdWorkspace: 1,
    IdAccount: 3,
    Name: "Nubank",
    Kind: "credit_card",
    DueDay: 4,
    ClosingOffsetDays: 7,
    CompetenceMode: "purchase",
    IconPath: null,
    Color: null,
    Position: null,
    Active: true,
    CreatedAt: "2026-01-01T00:00:00.000Z",
    UpdatedAt: "2026-01-01T00:00:00.000Z",
};

const entry = (values: Partial<ApiTypes.StatementCardEntry> = {}): ApiTypes.StatementCardEntry => ({
    Date: "2026-08-20",
    Description: "Mercado",
    Value: 100,
    IdExpense: 1,
    IdExpensePayment: 1,
    InstallmentNumber: null,
    InstallmentTotal: null,
    Paid: false,
    Charged: false,
    ...values,
});

describe("invoiceOf", () => {
    it("monta a fatura de setembro com a compra de agosto — o caso do modo `purchase`", () => {
        // A compra de 20/08 tem competência 20/08 e vencimento 04/09.
        // Enquanto a fatura saía das PERNAS DO MÊS, ela estava vazia nos
        // dois meses: em agosto a perna existia e o `DueDate` procurado
        // era 04/08; em setembro o `DueDate` batia e a perna não tinha
        // sido baixada. O extrato de setembro traz as duas coisas juntas.
        const invoice = invoiceOf(
            {
                IdPaymentMethod: 7,
                Name: "Nubank",
                DueDate: "2026-09-04",
                Total: 320,
                Entries: [
                    entry({ Value: 200, Charged: true }),
                    entry({ Date: "2026-08-28", Value: 120, IdExpense: 2, IdExpensePayment: 2 }),
                ],
            },
            card,
            "2026-09",
        );

        expect(invoice.due).toBe("2026-09-04");
        expect(invoice.closing).toBe("2026-08-28");
        expect(invoice.total).toBe(320);
        expect(invoice.charged).toBe(200);
        expect(invoice.entries).toHaveLength(2);
        expect(invoice.paid).toBe(false);
    });

    it("dá fatura vazia no mês em que o cartão não tem nada vencendo", () => {
        // Agosto, no mesmo cartão: nenhuma fatura vence lá dentro, e o
        // painel mostra zero com o botão desabilitado — o que agora é
        // verdade, e não o efeito de perguntar pela data errada.
        const invoice = invoiceOf(undefined, card, "2026-08");

        expect(invoice.due).toBe("2026-08-04");
        expect(invoice.total).toBe(0);
        expect(invoice.entries).toHaveLength(0);
        expect(invoice.paid).toBe(false);
    });

    it("só se diz quitada quando TODAS as linhas saíram", () => {
        const paid = (values: Partial<ApiTypes.StatementCardEntry>) =>
            entry({ Paid: true, ...values });

        const statementCard = (Entries: ApiTypes.StatementCardEntry[]): ApiTypes.StatementCard => ({
            IdPaymentMethod: 7,
            Name: "Nubank",
            DueDate: "2026-09-04",
            Total: 200,
            Entries,
        });

        expect(
            invoiceOf(statementCard([paid({}), paid({ Value: 100 })]), card, "2026-09").paid,
        ).toBe(true);
        expect(
            invoiceOf(statementCard([paid({}), entry({ Value: 100 })]), card, "2026-09").paid,
        ).toBe(false);
    });

    it("o estorno reduz o total, e quem soma é o servidor", () => {
        // O `Total` do extrato já vem com o sinal do estorno. A tela
        // EXIBE esse número — não o soma de novo, ou passariam a existir
        // duas respostas para "quanto esta fatura cobra".
        const invoice = invoiceOf(
            {
                IdPaymentMethod: 7,
                Name: "Nubank",
                DueDate: "2026-09-04",
                Total: 80,
                Entries: [entry({ Value: 200 }), entry({ Value: -120, Description: "Estorno" })],
            },
            card,
            "2026-09",
        );

        expect(invoice.total).toBe(80);
    });
});
