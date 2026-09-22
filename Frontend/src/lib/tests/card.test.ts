import { describe, expect, it } from "vitest";
import { cycleLabel, invoiceCycle, invoiceDates, invoiceOf } from "@/lib/card";
import type { ApiTypes } from "@/types/api";

describe("invoiceDates", () => {
    it("usa os dois dias do mês, e eles não mudam de mês para mês", () => {
        // Fecha 03 e vence 10: `ClosingDay <= DueDay`, os dois no mesmo mês.
        expect(invoiceDates("2026-09", 10, 3)).toEqual({
            closing: "2026-09-03",
            due: "2026-09-10",
        });
        expect(invoiceDates("2026-10", 10, 3)).toEqual({
            closing: "2026-10-03",
            due: "2026-10-10",
        });
    });

    /*  O CARTÃO QUE MOTIVOU A LEVA 9: fecha 27, vence 04. A folga que o
        modelo antigo guardava produzia 27/08 para a fatura de setembro e
        26/09 para a de outubro — o mesmo cartão com dois dias de
        fechamento, porque os meses têm tamanhos diferentes. Aqui o dia 27
        é o dia 27 nos três meses. */
    it("fecha no mês ANTERIOR quando o fechamento é depois do dia de vencer", () => {
        expect(invoiceDates("2026-09", 4, 27).closing).toBe("2026-08-27");
        expect(invoiceDates("2026-10", 4, 27).closing).toBe("2026-09-27");
        expect(invoiceDates("2026-11", 4, 27).closing).toBe("2026-10-27");
    });

    it("apara os dois dias no mês curto", () => {
        // Dia 31 em fevereiro é 28, e nunca 3 de março — nos dois dias.
        expect(invoiceDates("2026-02", 31, 30)).toEqual({
            closing: "2026-02-28",
            due: "2026-02-28",
        });
    });

    it("cai no fechamento quando o cartão não tem um", () => {
        // Sem `ClosingDay` não há o que inferir, e inventar um dia é
        // exatamente o que esta leva tirou do modelo: o fallback iguala
        // os dois dias em vez de chutar uma folga.
        expect(invoiceDates("2026-09", 10, null)).toEqual({
            closing: "2026-09-10",
            due: "2026-09-10",
        });
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
    ClosingDay: 28,
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
    /* A perna de cartão nasce NA FATURA: lançar num cartão é dizer que a
       compra vai para a fatura dele. O `false` é o clique raro. */
    Charged: true,
    ...values,
});

describe("invoiceCycle", () => {
    it("abre no dia seguinte ao fechamento da fatura anterior", () => {
        // Fecha 28 e vence 04: a fatura de setembro fecha em 28/08 e a
        // de agosto fechou em 28/07 — a compra do dia 28/07 ainda é da
        // outra, então esta começa no 29.
        expect(invoiceCycle("2026-09", 4, 28)).toEqual({
            start: "2026-07-29",
            end: "2026-08-28",
        });
    });

    it("não cabe num mês só, e é isso que a linha do ciclo existe para dizer", () => {
        // A fatura que a tela de setembro mostra é feita de compras de
        // julho e agosto. Num cartão em `purchase` foi lá que elas
        // pesaram — e nada na tela dizia isso.
        expect(cycleLabel(invoiceCycle("2026-09", 4, 28))).toBe("compras de 29 jul a 28 ago");
    });

    it("fecha no mesmo dia em todo mês, inclusive atravessando a virada", () => {
        // Fecha 27 e vence 04 — o cartão da leva 9. O ciclo anda um mês
        // inteiro de cada vez e sempre termina no dia 27: era a folga
        // que fazia o fim do ciclo pular para o 26 em metade do ano.
        expect(invoiceCycle("2026-10", 4, 27)).toEqual({
            start: "2026-08-28",
            end: "2026-09-27",
        });
        expect(invoiceCycle("2026-11", 4, 27)).toEqual({
            start: "2026-09-28",
            end: "2026-10-27",
        });
    });

    it("apara o fim do ciclo no mês curto", () => {
        // Fecha 30 e vence 05: fevereiro acaba no 28, e é lá que a
        // fatura de março fecha.
        expect(invoiceCycle("2026-03", 5, 30)).toEqual({
            start: "2026-01-31",
            end: "2026-02-28",
        });
    });
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
                CycleStart: "2026-07-29",
                CycleEnd: "2026-08-28",
                CompetenceMode: "purchase",
                Total: 320,
                Entries: [
                    entry({ Value: 200 }),
                    entry({ Date: "2026-08-28", Value: 120, IdExpense: 2, IdExpensePayment: 2 }),
                ],
                Expected: [],
            },
            card,
            "2026-09",
        );

        expect(invoice.due).toBe("2026-09-04");
        expect(invoice.closing).toBe("2026-08-28");
        //  O ciclo é o que o extrato recortou, não uma segunda conta feita aqui
        expect(invoice.cycle).toEqual({ start: "2026-07-29", end: "2026-08-28" });
        expect(invoice.total).toBe(320);
        expect(invoice.expected).toBe(0);
        expect(invoice.entries).toHaveLength(2);
        expect(invoice.paid).toBe(false);
    });

    it("soma o previsto à parte, e ele não entra no total da fatura", () => {
        // O grupo `Expected` é o caso RARO: a compra que o usuário
        // desmarcou porque o emissor ainda não registrou. Ela fica fora
        // do que a fatura cobra — mas dentro das linhas, porque quitar a
        // fatura quita o ciclo inteiro e ela sai da conta junto.
        const invoice = invoiceOf(
            {
                IdPaymentMethod: 7,
                Name: "Nubank",
                DueDate: "2026-09-04",
                CycleStart: "2026-07-29",
                CycleEnd: "2026-08-28",
                CompetenceMode: "purchase",
                Total: 200,
                Entries: [entry({ Value: 200 })],
                Expected: [entry({ Value: 50, Charged: false, IdExpense: 2, IdExpensePayment: 2 })],
            },
            card,
            "2026-09",
        );

        expect(invoice.total).toBe(200);
        expect(invoice.expected).toBe(50);
        expect(invoice.entries).toHaveLength(2);
    });

    it("dá fatura vazia no mês em que o cartão não tem nada vencendo", () => {
        // Agosto, no mesmo cartão: nenhuma fatura vence lá dentro, e o
        // painel mostra zero com o botão desabilitado — o que agora é
        // verdade, e não o efeito de perguntar pela data errada.
        const invoice = invoiceOf(undefined, card, "2026-08");

        expect(invoice.due).toBe("2026-08-04");
        //  Sem fatura não há o que recortar, e o ciclo é o calculado do cadastro
        expect(invoice.cycle).toEqual({ start: "2026-06-29", end: "2026-07-28" });
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
            CycleStart: "2026-07-29",
            CycleEnd: "2026-08-28",
            CompetenceMode: "purchase",
            Total: 200,
            Entries,
            Expected: [],
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
                CycleStart: "2026-07-29",
                CycleEnd: "2026-08-28",
                CompetenceMode: "purchase",
                Total: 80,
                Entries: [entry({ Value: 200 }), entry({ Value: -120, Description: "Estorno" })],
                Expected: [],
            },
            card,
            "2026-09",
        );

        expect(invoice.total).toBe(80);
    });
});
