import { describe, expect, it } from "vitest";
import {
    budgetPercent,
    budgetRemaining,
    budgetState,
    impliedLeg,
    legsOfKind,
    monthLegs,
    spentByCategory,
    spentByDay,
    sumMoney,
    totalBalance,
    totalExpectedInflow,
    totalPaid,
    totalPending,
    totalReceived,
    totalSpent,
} from "@/lib/aggregate";
import {
    aBudgetPeriod,
    anAccount,
    anExpense,
    anExpenseDetail,
    anInflow,
    anInstallment,
    aPayment,
} from "./factories";

describe("sumMoney", () => {
    it("soma em centavos: 0,1 + 0,2 é 0,30 e não 0,30000000000000004", () => {
        expect(sumMoney([0.1, 0.2])).toBe(0.3);
    });

    it("não acumula erro em muitas parcelas", () => {
        expect(sumMoney(Array.from({ length: 30 }, () => 0.1))).toBe(3);
    });
});

describe("totalReceived", () => {
    it("ignora transferência: mover dinheiro entre contas não é renda", () => {
        const total = totalReceived([
            anInflow({ IdInflow: 1, TotalValue: 5000 }),
            anInflow({ IdInflow: 2, TotalValue: 1000, Kind: "transfer", IdFromAccount: 2 }),
        ]);

        // Sem o filtro, o mesmo dinheiro seria contado de novo a cada
        // movimentação entre contas — daria 6000.
        expect(total).toBe(5000);
    });

    it("conta só o que já foi recebido", () => {
        const total = totalReceived([
            anInflow({ IdInflow: 1, TotalValue: 5000, Status: "received" }),
            anInflow({ IdInflow: 2, TotalValue: 900, Status: "pending" }),
            anInflow({ IdInflow: 3, TotalValue: 400, Status: "canceled" }),
        ]);

        expect(total).toBe(5000);
    });
});

describe("totalExpectedInflow", () => {
    it("é o que está pendente, sem transferência", () => {
        const total = totalExpectedInflow([
            anInflow({ IdInflow: 1, TotalValue: 900, Status: "pending" }),
            anInflow({
                IdInflow: 2,
                TotalValue: 300,
                Status: "pending",
                Kind: "transfer",
                IdFromAccount: 2,
            }),
            anInflow({ IdInflow: 3, TotalValue: 5000, Status: "received" }),
        ]);

        expect(total).toBe(900);
    });
});

describe("impliedLeg", () => {
    it("dá a perna de um gasto à vista sem precisar do detalhe", () => {
        const leg = impliedLeg(anExpense({ TotalValue: 250, ExpenseDate: "2026-08-10" }));

        expect(leg).toMatchObject({ value: 250, month: "2026-08" });
    });

    it("recusa parcelado: a lista não sabe quanto cabe a cada mês", () => {
        // 600 em 6x na lista aparece como uma compra de 600. Chutar aqui
        // colocaria 600 no mês da compra em vez de 100.
        expect(impliedLeg(anExpense({ Kind: "installment", TotalValue: 600 }))).toBeNull();
    });
});

describe("monthLegs", () => {
    it("600 em 6x custa 100 ao mês, não 600", () => {
        const legs = monthLegs("2026-08", [], [anInstallment({ total: 600, parts: 6 })]);

        expect(totalSpent(legs)).toBe(100);
    });

    it("a parcela cai no mês da fatura, e a compra de agosto pesa em setembro", () => {
        const parcelado = anInstallment({ total: 600, parts: 6, firstDueMonth: 8 });

        expect(totalSpent(monthLegs("2026-09", [], [parcelado]))).toBe(100);
        expect(totalSpent(monthLegs("2027-02", [], [parcelado]))).toBe(0);
        expect(totalSpent(monthLegs("2027-01", [], [parcelado]))).toBe(100);
    });

    it("o centavo que sobra vai na primeira parcela", () => {
        const legs = monthLegs("2026-08", [], [anInstallment({ total: 100, parts: 3 })]);

        expect(totalSpent(legs)).toBe(33.34);
        expect(
            totalSpent(monthLegs("2026-09", [], [anInstallment({ total: 100, parts: 3 })])),
        ).toBe(33.33);
    });

    it("gasto cancelado não conta", () => {
        const legs = monthLegs("2026-08", [
            anExpense({ IdExpense: 1, TotalValue: 100 }),
            anExpense({ IdExpense: 2, TotalValue: 999, Status: "canceled" }),
        ]);

        expect(totalSpent(legs)).toBe(100);
    });

    it("não conta duas vezes o gasto que veio na lista e no detalhe", () => {
        const parcelado = anInstallment({ IdExpense: 7, total: 600, parts: 6 });
        const legs = monthLegs("2026-08", [parcelado], [parcelado]);

        expect(totalSpent(legs)).toBe(100);
    });

    it("um gasto no cartão pesa no mês do vencimento da fatura", () => {
        // Comprou em 25/08, a fatura vence em 27/09: agosto não sente.
        const noCartao = anExpenseDetail({
            IdExpense: 3,
            TotalValue: 320,
            ExpenseDate: "2026-08-25",
            Payments: [aPayment({ Value: 320, DueDate: "2026-09-27" })],
        });

        expect(totalSpent(monthLegs("2026-08", [], [noCartao]))).toBe(0);
        expect(totalSpent(monthLegs("2026-09", [], [noCartao]))).toBe(320);
    });
});

describe("totalPaid e totalPending", () => {
    it("separam o que já saiu da conta do que ainda vai sair", () => {
        const legs = monthLegs(
            "2026-08",
            [],
            [anInstallment({ IdExpense: 1, total: 600, parts: 6, paidUntil: 1 })],
        );

        expect(totalPaid(legs)).toBe(100);
        expect(totalPending(legs)).toBe(0);
    });

    it("um gasto pendente do mês entra em pending", () => {
        const legs = monthLegs("2026-08", [anExpense({ TotalValue: 80, Status: "pending" })]);

        expect(totalPending(legs)).toBe(80);
        expect(totalPaid(legs)).toBe(0);
    });
});

describe("legsOfKind", () => {
    it("recorta os fixos e as parcelas do mês", () => {
        const legs = monthLegs(
            "2026-08",
            [
                anExpense({ IdExpense: 1, TotalValue: 90 }),
                anExpense({ IdExpense: 2, TotalValue: 1200, Kind: "fixed" }),
            ],
            [anInstallment({ IdExpense: 3, total: 600, parts: 6 })],
        );

        expect(totalSpent(legsOfKind(legs, "fixed"))).toBe(1200);
        expect(totalSpent(legsOfKind(legs, "installment"))).toBe(100);
        expect(totalSpent(legsOfKind(legs, "single"))).toBe(90);
    });
});

describe("spentByCategory", () => {
    it("agrupa e ordena do maior para o menor", () => {
        const legs = monthLegs("2026-08", [
            anExpense({ IdExpense: 1, IdCategory: 1, TotalValue: 100 }),
            anExpense({ IdExpense: 2, IdCategory: 2, TotalValue: 300 }),
            anExpense({ IdExpense: 3, IdCategory: 1, TotalValue: 50 }),
        ]);

        expect(spentByCategory(legs)).toEqual([
            { IdCategory: 2, value: 300 },
            { IdCategory: 1, value: 150 },
        ]);
    });

    it("o total do donut bate com o total gasto do mês", () => {
        const legs = monthLegs(
            "2026-08",
            [anExpense({ IdExpense: 1, IdCategory: 2, TotalValue: 45.9 })],
            [anInstallment({ IdExpense: 2, total: 600, parts: 6 })],
        );

        expect(sumMoney(spentByCategory(legs).map((slice) => slice.value))).toBe(totalSpent(legs));
    });
});

describe("spentByDay", () => {
    it("devolve um valor por dia do eixo, zero incluído", () => {
        const legs = monthLegs("2026-08", [
            anExpense({ IdExpense: 1, ExpenseDate: "2026-08-02", TotalValue: 30 }),
            anExpense({ IdExpense: 2, ExpenseDate: "2026-08-02", TotalValue: 20 }),
        ]);

        expect(spentByDay(legs, ["2026-08-01", "2026-08-02", "2026-08-03"])).toEqual([0, 50, 0]);
    });

    it("a parcela cai no dia do vencimento, não no da compra", () => {
        const legs = monthLegs("2026-09", [], [anInstallment({ total: 600, parts: 6 })]);

        expect(spentByDay(legs, ["2026-09-10", "2026-09-27"])).toEqual([0, 100]);
    });
});

describe("totalBalance", () => {
    it("soma o Balance que a API calculou, e só das contas ativas", () => {
        const total = totalBalance([
            anAccount({ IdAccount: 1, Balance: 1875.4 }),
            anAccount({ IdAccount: 2, Balance: 300 }),
            anAccount({ IdAccount: 3, Balance: 999, Active: false }),
        ]);

        expect(total).toBe(2175.4);
    });
});

describe("budgetState", () => {
    it("é ok abaixo do alerta", () => {
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: 400 }))).toBe("ok");
    });

    it("alerta a partir do AlertPercent, não de um número fixo", () => {
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: 640 }))).toBe("alert");
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: 640, AlertPercent: 90 }))).toBe(
            "ok",
        );
    });

    it("estoura só acima do teto — gastar exatamente o teto ainda é alerta", () => {
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: 800 }))).toBe("alert");
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: 800.01 }))).toBe("over");
    });
});

describe("budgetPercent e budgetRemaining", () => {
    it("o consumo passa de 100% no estouro, e o que sobra fica negativo", () => {
        const period = aBudgetPeriod({ LimitValue: 800, Spent: 900 });

        expect(budgetPercent(period)).toBeCloseTo(112.5);
        expect(budgetRemaining(period)).toBe(-100);
    });
});
