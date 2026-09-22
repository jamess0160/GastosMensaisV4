import { describe, expect, it } from "vitest";
import {
    installmentLabel,
    isLegOverdue,
    legMatches,
    legStatus,
    type LegFilters,
} from "../src/rows";
import { paymentLegs, totalSpent, type ExpenseLeg } from "@/lib/aggregate";
import { aLegRow, anExpense, anExpensePerson, installmentRows } from "@/lib/tests/factories";
import type { ApiTypes } from "@/types/api";

/* Os dois casos que a leva 9 existe para consertar:

   1. a geladeira de 600 em 6× comprada em JUNHO, que não aparecia em
      julho, agosto nem setembro — a tabela listava compras;
   2. a compra no cartão feita ontem, que ficava vermelha hoje porque o
      alerta comparava a data da COMPRA com o relógio. */

/** Os filtros com que a tela nasce: tudo menos cancelado. */
const defaultFilters = (overrides: Partial<LegFilters> = {}): LegFilters => ({
    statuses: ["pending", "paid"],
    kinds: [],
    idCategories: [],
    idPersons: [],
    idMethods: [],
    search: "",
    ...overrides,
});

/** A lista de um mês, como `useMonthLegs` a entrega: as pernas que a
 *  API devolveu para o período, cancelados inclusive. */
const legsOfMonth = (
    rows: readonly ApiTypes.ExpensePaymentRow[],
    month: ApiTypes.ReferenceMonth,
): ExpenseLeg[] =>
    paymentLegs(
        rows.filter((row) => row.CompetenceDate.startsWith(month)),
        true,
    );

/** 600 em 6×, COMPRADA em 20/06: as seis pernas vencem de 27/07 a
 *  27/12, e as duas primeiras já foram quitadas. A compra tem UMA linha
 *  em `GET /Expenses`, em junho — e era só ela que a tabela listava. */
const geladeira = (overrides = {}) =>
    installmentRows({
        IdExpense: 7,
        Description: "Geladeira",
        ExpenseDate: "2026-06-20",
        total: 600,
        parts: 6,
        firstDueMonth: 7,
        paidUntil: 2,
        ...overrides,
    });

describe("a parcela de uma compra de mês anterior", () => {
    it("tem linha em setembro, com o valor da PARCELA e não o da compra", () => {
        const setembro = legsOfMonth(geladeira(), "2026-09");

        expect(setembro).toHaveLength(1);
        expect(setembro[0].expense.Description).toBe("Geladeira");
        // A COMPRA é de junho e vale 600; setembro custou 100.
        expect(setembro[0].expense.ExpenseDate).toBe("2026-06-20");
        expect(setembro[0].expense.TotalValue).toBe(600);
        expect(setembro[0].value).toBe(100);
    });

    it("diz que é a 3 de 6", () => {
        const [setembro] = legsOfMonth(geladeira(), "2026-09");

        expect(installmentLabel(setembro.payment)).toBe("3/6");
    });

    it("a soma da lista filtrada é o total do mês, ao centavo", () => {
        const rows = [
            ...geladeira(),
            aLegRow(anExpense({ IdExpense: 9, Description: "Mercado", TotalValue: 1240 }), {
                IdExpensePayment: 90,
                DueDate: "2026-09-12",
                CompetenceDate: "2026-09-12",
                CashDate: "2026-09-12",
            }),
        ];

        const rowsOfSeptember = legsOfMonth(rows, "2026-09").filter((leg) =>
            legMatches(leg, defaultFilters()),
        );

        /* Era ESTE o número que divergia: a faixa de indicadores somava
           pernas e dizia 1.340, e a tabela — que listava compras —
           somava 1.240, sem nada na tela explicando os 100 que
           faltavam. */
        expect(totalSpent(rowsOfSeptember)).toBe(1340);
    });

    it("a parcela quitada é 'Pagos' no mês dela, mesmo com a compra em aberto", () => {
        const [julho] = legsOfMonth(geladeira(), "2026-07");
        const [setembro] = legsOfMonth(geladeira(), "2026-09");

        // O `Status` do gasto é o mesmo nas duas: só vira `paid` quando
        // TODAS as seis pernas estiverem quitadas. Era ele que deixava o
        // parcelado "em aberto" nos seis meses, quitados inclusive.
        expect(julho.expense.Status).toBe("pending");
        expect(setembro.expense.Status).toBe("pending");

        expect(legStatus(julho)).toBe("paid");
        expect(legStatus(setembro)).toBe("pending");
    });

    it("o chip 'Pagos' mostra o mês quitado e esconde o que ainda vence", () => {
        const pagos = defaultFilters({ statuses: ["paid"] });
        const inMonth = (month: ApiTypes.ReferenceMonth) =>
            legsOfMonth(geladeira(), month).filter((leg) => legMatches(leg, pagos));

        expect(inMonth("2026-07")).toHaveLength(1);
        expect(inMonth("2026-09")).toHaveLength(0);
    });
});

describe("o vermelho segue a CashDate, não a data da compra", () => {
    /** Compra de 10/09 num cartão em modo `purchase`: pesa em setembro e
     *  sai da conta com a fatura, em 04/10. */
    const noCartao = (payment: Partial<ApiTypes.ExpensePayment> = {}) =>
        paymentLegs([
            aLegRow(anExpense({ IdExpense: 3, Description: "Tênis", ExpenseDate: "2026-09-10" }), {
                IdExpensePayment: 30,
                DueDate: "2026-10-04",
                CompetenceDate: "2026-09-10",
                CashDate: "2026-10-04",
                // Fora do cartão este campo é `null`: é a nulidade
                // que diz que a perna tem fatura.
                Charged: true,
                Paid: false,
                ...payment,
            }),
        ])[0];

    it("não fica vermelha três dias depois da compra, com a fatura a vencer", () => {
        // A perna está `pending` — a fatura não foi paga — e a data da
        // compra já passou. Era essa dupla que pintava a linha.
        expect(legStatus(noCartao())).toBe("pending");
        expect(isLegOverdue(noCartao(), "2026-09-13")).toBe(false);
    });

    it("continua preta no dia do vencimento da fatura", () => {
        expect(isLegOverdue(noCartao(), "2026-10-04")).toBe(false);
    });

    it("fica vermelha no dia seguinte ao vencimento da fatura", () => {
        expect(isLegOverdue(noCartao(), "2026-10-05")).toBe(true);
    });

    it("a fatura paga nunca fica vermelha", () => {
        expect(isLegOverdue(noCartao({ Paid: true }), "2026-11-01")).toBe(false);
    });

    it("fora do cartão as duas datas são iguais e o atraso é o do dia seguinte", () => {
        const [boleto] = paymentLegs([
            aLegRow(anExpense({ Description: "Aluguel" }), {
                DueDate: "2026-09-05",
                CompetenceDate: "2026-09-05",
                CashDate: "2026-09-05",
            }),
        ]);

        expect(isLegOverdue(boleto, "2026-09-05")).toBe(false);
        expect(isLegOverdue(boleto, "2026-09-06")).toBe(true);
    });

    it("gasto cancelado não está atrasado — ele não conta em lugar nenhum", () => {
        const [cancelado] = paymentLegs(
            [
                aLegRow(anExpense({ Status: "canceled" }), {
                    DueDate: "2026-09-05",
                    CompetenceDate: "2026-09-05",
                    CashDate: "2026-09-05",
                }),
            ],
            true,
        );

        expect(legStatus(cancelado)).toBe("canceled");
        expect(isLegOverdue(cancelado, "2026-12-01")).toBe(false);
    });
});

describe("legMatches", () => {
    const [leg] = paymentLegs([
        aLegRow(
            anExpense({ Description: "Mercado do bairro", IdCategory: 4, Kind: "single" }),
            { IdPaymentMethod: 2 },
            [anExpensePerson(8, 100)],
        ),
    ]);

    it("vazio em cada filtro é 'sem recorte'", () => {
        expect(legMatches(leg, defaultFilters())).toBe(true);
    });

    it("recorta por categoria, formato e forma de pagamento da PERNA", () => {
        expect(legMatches(leg, defaultFilters({ idCategories: [4] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idCategories: [5] }))).toBe(false);
        expect(legMatches(leg, defaultFilters({ kinds: ["single"] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ kinds: ["fixed"] }))).toBe(false);
        expect(legMatches(leg, defaultFilters({ idMethods: [2] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idMethods: [3] }))).toBe(false);
    });

    it("recorta pelo rateio do gasto, que vem igual em toda perna dele", () => {
        expect(legMatches(leg, defaultFilters({ idPersons: [8] }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ idPersons: [9] }))).toBe(false);
    });

    it("a busca é da descrição, sem caixa", () => {
        expect(legMatches(leg, defaultFilters({ search: "  BAIRRO " }))).toBe(true);
        expect(legMatches(leg, defaultFilters({ search: "padaria" }))).toBe(false);
    });

    it("o cancelado só aparece com o chip dele marcado", () => {
        const [cancelado] = paymentLegs([aLegRow(anExpense({ Status: "canceled" }))], true);

        expect(legMatches(cancelado, defaultFilters())).toBe(false);
        expect(legMatches(cancelado, defaultFilters({ statuses: ["canceled"] }))).toBe(true);
    });
});

describe("installmentLabel", () => {
    it("é nulo quando a perna não é parcela de nada", () => {
        const [avulso] = paymentLegs([aLegRow(anExpense())]);

        expect(installmentLabel(avulso.payment)).toBeNull();
    });
});
