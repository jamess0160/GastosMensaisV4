import { describe, expect, it } from "vitest";
import {
    cardCycleFromDates,
    checkCardCycle,
    cycleLabel,
    DEFAULT_CLOSING_OFFSET_DAYS,
    invoiceCycle,
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

describe("checkCardCycle", () => {
    /*  O caso real que abriu a etapa 2 da leva 6: um cartão que fecha
        dia 27 e vence dia 04. Lendo a fatura de agosto (27/08 a 04/09) a
        folga gravada é 8; em setembro (27/09 a 04/10) ela seria 7, e o
        fechamento derivado de setembro cai no dia 26. Uma compra do dia
        27/09 vai parar na fatura de 04/11 — um dia de diferença na
        descrição virando um mês de diferença no caixa. */
    it("acusa o fechamento que anda de mês para mês", () => {
        const check = checkCardCycle("2026-08-27", "2026-09-04", "2026-09");

        expect(check.typedClosingDay).toBe(27);
        expect(check.drifts).toBe(true);
        // Fevereiro puxa o fechamento para o dia 24; os meses de 31 dias
        // o devolvem ao 27, que é o único que o emissor usaria.
        expect(check.closingDays).toContain(26);
        expect(check.closingDays.length).toBeGreaterThan(1);
    });

    it("não acusa nada quando a subtração não atravessa a virada do mês", () => {
        // Vence 28 e fecha 8 dias antes: o dia 20 do mesmo mês, sempre.
        // Aqui folga e dia fixo do mês descrevem o MESMO cartão.
        const check = checkCardCycle("2026-08-20", "2026-08-28", "2026-09");

        expect(check.drifts).toBe(false);
        expect(check.closingDays).toEqual([20]);
    });

    it("devolve as duas datas do mês pedido, e não as que foram digitadas", () => {
        // O ciclo digitado é o de uma fatura passada; o que a tela mostra
        // para conferência é a fatura do mês corrente.
        const check = checkCardCycle("2026-08-27", "2026-09-04", "2026-10");

        expect(check.due).toBe("2026-10-04");
        expect(check.closing).toBe("2026-09-26");
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
    /* A perna de cartão nasce NA FATURA: lançar num cartão é dizer que a
       compra vai para a fatura dele. O `false` é o clique raro. */
    Charged: true,
    ...values,
});

describe("invoiceCycle", () => {
    it("abre no dia seguinte ao fechamento da fatura anterior", () => {
        // Vencendo dia 4 com folga de 7: a fatura de setembro fecha em
        // 28/08 e a de agosto fechou em 28/07 — a compra do dia 28/07
        // ainda é da outra, então esta começa no 29.
        expect(invoiceCycle("2026-09", 4, 7)).toEqual({
            start: "2026-07-29",
            end: "2026-08-28",
        });
    });

    it("não cabe num mês só, e é isso que a linha do ciclo existe para dizer", () => {
        // A fatura que a tela de setembro mostra é feita de compras de
        // julho e agosto. Num cartão em `purchase` foi lá que elas
        // pesaram — e nada na tela dizia isso.
        expect(cycleLabel(invoiceCycle("2026-09", 4, 7))).toBe("compras de 29 jul a 28 ago");
    });

    it("acompanha a virada do mês, porque o fechamento derivado anda junto", () => {
        // Vencendo dia 5 com folga de 7, o fechamento cai sempre no mês
        // ANTERIOR ao do vencimento: fevereiro fechou em 29/01 e março
        // fecha em 26/02 — dias diferentes, porque a folga é uma
        // subtração de dias corridos e os meses não têm o mesmo tamanho.
        expect(invoiceCycle("2026-03", 5, 7)).toEqual({
            start: "2026-01-30",
            end: "2026-02-26",
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
        expect(invoice.cycle).toEqual({ start: "2026-06-28", end: "2026-07-28" });
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
