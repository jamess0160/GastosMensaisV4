import { describe, expect, it } from "vitest";
import {
    budgetChain,
    budgetPercent,
    budgetRemaining,
    budgetState,
    budgetTargetName,
    legsOfKind,
    paymentLegs,
    spentByCategory,
    spentByDay,
    spentByMonthCategory,
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
    aLegRow,
    aPersonBudgetPeriod,
    aPersonCategoryBudgetPeriod,
    anAccount,
    anExpense,
    anInflow,
    installmentRows,
} from "./factories";
import type { ApiTypes } from "@/types/api";

/** O recorte que a API faz: `GET /ExpensePayments?From=&To=` devolve as
 *  pernas cuja `CompetenceDate` cai no período. Aqui ele é imitado sobre
 *  as pernas de teste, para que cada caso diga de que MÊS está falando. */
const inMonth = (month: ApiTypes.ReferenceMonth, rows: readonly ApiTypes.ExpensePaymentRow[]) =>
    paymentLegs(rows.filter((row) => row.CompetenceDate.startsWith(month)));

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

describe("paymentLegs", () => {
    it("600 em 6x custa 100 ao mês, não 600", () => {
        expect(totalSpent(inMonth("2026-08", installmentRows({ total: 600, parts: 6 })))).toBe(100);
    });

    it("a parcela cai no mês da fatura, e a compra de agosto pesa em setembro", () => {
        const rows = installmentRows({ total: 600, parts: 6, firstDueMonth: 8 });

        expect(totalSpent(inMonth("2026-09", rows))).toBe(100);
        expect(totalSpent(inMonth("2027-01", rows))).toBe(100);
        expect(totalSpent(inMonth("2027-02", rows))).toBe(0);
    });

    it("a parcela de uma compra de 3 anos atrás entra no total do mês", () => {
        // Era o único lugar em que o número na tela ficava ERRADO, e não
        // só ausente: a varredura de 24 meses para trás não alcançava a
        // compra, e a parcela sumia do mês. A lista de pernas não tem
        // janela — quem recorta é a competência da própria perna.
        const rows = installmentRows({
            total: 12000,
            parts: 60,
            firstDueMonth: 1,
            year: 2023,
        });

        expect(totalSpent(inMonth("2026-08", rows))).toBe(200);
    });

    it("o centavo que sobra vai na primeira parcela", () => {
        const rows = installmentRows({ total: 100, parts: 3 });

        expect(totalSpent(inMonth("2026-08", rows))).toBe(33.34);
        expect(totalSpent(inMonth("2026-09", rows))).toBe(33.33);
    });

    it("gasto cancelado não conta", () => {
        const legs = paymentLegs([
            aLegRow(anExpense({ IdExpense: 1, TotalValue: 100 })),
            aLegRow(anExpense({ IdExpense: 2, TotalValue: 999, Status: "canceled" })),
        ]);

        expect(totalSpent(legs)).toBe(100);
    });

    it("um gasto no cartão pesa no mês do vencimento da fatura", () => {
        // Comprou em 25/08, a fatura vence em 27/09: agosto não sente.
        const noCartao = aLegRow(
            anExpense({ IdExpense: 3, TotalValue: 320, ExpenseDate: "2026-08-25" }),
            { Value: 320, DueDate: "2026-09-27", CompetenceDate: "2026-09-27" },
        );

        expect(totalSpent(inMonth("2026-08", [noCartao]))).toBe(0);
        expect(totalSpent(inMonth("2026-09", [noCartao]))).toBe(320);
    });
});

describe("totalPaid e totalPending", () => {
    it("separam o que já saiu da conta do que ainda vai sair", () => {
        const legs = inMonth(
            "2026-08",
            installmentRows({ IdExpense: 1, total: 600, parts: 6, paidUntil: 1 }),
        );

        expect(totalPaid(legs)).toBe(100);
        expect(totalPending(legs)).toBe(0);
    });

    it("um gasto pendente do mês entra em pending", () => {
        const legs = paymentLegs([aLegRow(anExpense({ TotalValue: 80, Status: "pending" }))]);

        expect(totalPending(legs)).toBe(80);
        expect(totalPaid(legs)).toBe(0);
    });
});

describe("legsOfKind", () => {
    it("recorta os fixos e as parcelas do mês", () => {
        const legs = inMonth("2026-08", [
            aLegRow(anExpense({ IdExpense: 1, TotalValue: 90 })),
            aLegRow(anExpense({ IdExpense: 2, TotalValue: 1200, Kind: "fixed" })),
            ...installmentRows({ IdExpense: 3, total: 600, parts: 6 }),
        ]);

        expect(totalSpent(legsOfKind(legs, "fixed"))).toBe(1200);
        expect(totalSpent(legsOfKind(legs, "installment"))).toBe(100);
        expect(totalSpent(legsOfKind(legs, "single"))).toBe(90);
    });
});

describe("spentByMonthCategory", () => {
    const months = ["2026-07", "2026-08"];

    it("dá uma série por categoria, com um valor por mês do período", () => {
        const legs = paymentLegs([
            aLegRow(
                anExpense({
                    IdExpense: 1,
                    IdCategory: 1,
                    TotalValue: 100,
                    ExpenseDate: "2026-07-05",
                }),
            ),
            aLegRow(
                anExpense({
                    IdExpense: 2,
                    IdCategory: 1,
                    TotalValue: 40,
                    ExpenseDate: "2026-08-05",
                }),
            ),
            aLegRow(
                anExpense({
                    IdExpense: 3,
                    IdCategory: 2,
                    TotalValue: 300,
                    ExpenseDate: "2026-08-06",
                }),
            ),
        ]);

        expect(spentByMonthCategory(legs, months)).toEqual([
            { IdCategory: 2, total: 300, values: [0, 300] },
            { IdCategory: 1, total: 140, values: [100, 40] },
        ]);
    });

    it("mantém o mês sem gasto no eixo, com zero", () => {
        const legs = paymentLegs([
            aLegRow(
                anExpense({
                    IdExpense: 1,
                    IdCategory: 1,
                    TotalValue: 50,
                    ExpenseDate: "2026-08-05",
                }),
            ),
        ]);

        expect(spentByMonthCategory(legs, months)[0].values).toEqual([0, 50]);
    });

    it("ignora a perna que cai fora do período pedido", () => {
        const legs = paymentLegs([
            aLegRow(
                anExpense({
                    IdExpense: 1,
                    IdCategory: 1,
                    TotalValue: 90,
                    ExpenseDate: "2026-06-05",
                }),
            ),
        ]);

        expect(spentByMonthCategory(legs, months)).toEqual([]);
    });
});

describe("spentByCategory", () => {
    it("agrupa e ordena do maior para o menor", () => {
        const legs = paymentLegs([
            aLegRow(anExpense({ IdExpense: 1, IdCategory: 1, TotalValue: 100 })),
            aLegRow(anExpense({ IdExpense: 2, IdCategory: 2, TotalValue: 300 })),
            aLegRow(anExpense({ IdExpense: 3, IdCategory: 1, TotalValue: 50 })),
        ]);

        expect(spentByCategory(legs)).toEqual([
            { IdCategory: 2, value: 300 },
            { IdCategory: 1, value: 150 },
        ]);
    });

    it("o total do donut bate com o total gasto do mês", () => {
        const legs = inMonth("2026-08", [
            aLegRow(anExpense({ IdExpense: 1, IdCategory: 2, TotalValue: 45.9 })),
            ...installmentRows({ IdExpense: 2, total: 600, parts: 6 }),
        ]);

        expect(sumMoney(spentByCategory(legs).map((slice) => slice.value))).toBe(totalSpent(legs));
    });
});

describe("spentByDay", () => {
    it("devolve um valor por dia do eixo, zero incluído", () => {
        const legs = paymentLegs([
            aLegRow(anExpense({ IdExpense: 1, ExpenseDate: "2026-08-02", TotalValue: 30 })),
            aLegRow(anExpense({ IdExpense: 2, ExpenseDate: "2026-08-02", TotalValue: 20 })),
        ]);

        expect(spentByDay(legs, ["2026-08-01", "2026-08-02", "2026-08-03"])).toEqual([0, 50, 0]);
    });

    it("a parcela cai no dia do vencimento, não no da compra", () => {
        const legs = inMonth("2026-09", installmentRows({ total: 600, parts: 6 }));

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

describe("budgetTargetName", () => {
    it("lê o par que veio preenchido, um de cada vez", () => {
        expect(budgetTargetName(aBudgetPeriod())).toBe("Alimentação");
        expect(budgetTargetName(aPersonBudgetPeriod())).toBe("Maria");
    });

    /* O terceiro formato de alvo: a pessoa NAQUELA categoria. O nome é
       composto porque nenhuma das duas metades sozinha identifica a
       fatia — "Maria" e "Maria · Alimentação" convivem na mesma lista. */
    it("compõe pessoa e categoria quando os dois vêm", () => {
        expect(budgetTargetName(aPersonCategoryBudgetPeriod())).toBe("Maria · Alimentação");
    });

    /* O alvo arquivado some da lista do mês, então este é um caso que não
       deveria acontecer — e não o normal. */
    it("nomeia o alvo arquivado em vez de deixar a fatia sem nome", () => {
        expect(budgetTargetName(aPersonBudgetPeriod({ Person: null }))).toBe("Pessoa arquivada");
        expect(budgetTargetName(aBudgetPeriod({ Category: null }))).toBe("Categoria arquivada");
    });
});

describe("orçamento com Spent negativo", () => {
    /* Um mês em que os estornos superam as compras fecha abaixo de zero.
       Não é bug — o crédito volta no mês de competência do estorno, que
       costuma ser outro mês. */

    it("não estoura nem alerta", () => {
        expect(budgetState(aBudgetPeriod({ LimitValue: 800, Spent: -120 }))).toBe("ok");
    });

    it("consumiu 0% do teto, e não −15%", () => {
        expect(budgetPercent(aBudgetPeriod({ LimitValue: 800, Spent: -120 }))).toBe(0);
    });

    it("sobra MAIS do que o teto, que é a leitura certa", () => {
        expect(budgetRemaining(aBudgetPeriod({ LimitValue: 800, Spent: -120 }))).toBe(920);
    });
});

describe("budgetChain", () => {
    /* A cadeia do Orçamento é uma DECOMPOSIÇÃO do `Available` da rota, e
       este describe existe para travar a identidade que a torna
       verificável: `Livre − ExpensesSingle = Available`, ao centavo.

       É ela que faz a última linha do Orçamento pousar no mesmo número
       que o "Restante" do Início por identidade, e não por coincidência —
       e se um dia não pousar, é a cadeia que está errada, não o Início. */

    /** Um mês com centavos feios em todos os termos, e com o `Available`
     *  escrito à mão: ele é a resposta da ROTA, não uma conta repetida
     *  aqui — repeti-la faria o teste provar que a fórmula é igual a si
     *  mesma. */
    const aMonthReport = (overrides: Partial<ApiTypes.MonthReport> = {}): ApiTypes.MonthReport => ({
        ReferenceMonth: "2026-10-01",
        OpeningBalance: 1500.55,
        InitialBalances: 300.1,
        Inflows: 10226,
        InflowsReceived: 10226,
        InflowsPending: 0,
        Expenses: 5508.07,
        ExpensesFixed: 3454,
        ExpensesInstallments: 1800,
        ExpensesSingle: 254.07,
        PastCommitments: 120.33,
        OverdueReceivable: 90.01,
        OverduePayable: 40.02,
        Available: 6448.24,
        CurrentBalance: 4000,
        OpenInvoices: 0,
        ...overrides,
    });

    it("soma os quatro termos-ponte numa linha só", () => {
        //  300,10 − 120,33 + 90,01 − 40,02
        expect(budgetChain(aMonthReport()).adjustments).toBe(229.76);
    });

    it("tira do que sobra o fixo e a parcela, e não o avulso", () => {
        //  1.500,55 + 10.226,00 − 3.454,00 − 1.800,00 + 229,76
        expect(budgetChain(aMonthReport()).free).toBe(6702.31);
    });

    /* **A propriedade que torna a etapa verificável.** */
    it("fecha no Available da rota, ao centavo", () => {
        const report = aMonthReport();

        expect(budgetChain(report).available).toBe(report.Available);
    });

    /* O mesmo, num mês em que todos os termos-ponte são zero e o saldo de
       abertura também: é o caso que abriu a leva 11 — 10.226 de renda,
       5.254 entre fixos e parcelas, e a tela pedindo para repartir os
       10.226. O que sobra é 4.972, e é ele o total do rateio. */
    it("reparte o que sobra, e não a renda do mês", () => {
        const chain = budgetChain(
            aMonthReport({
                OpeningBalance: 0,
                InitialBalances: 0,
                PastCommitments: 0,
                OverdueReceivable: 0,
                OverduePayable: 0,
                ExpensesFixed: 3454,
                ExpensesInstallments: 1800,
                ExpensesSingle: 0,
                Expenses: 5254,
                Available: 4972,
            }),
        );

        expect(chain.free).toBe(4972);
        expect(chain.available).toBe(4972);
    });

    /* Um mês de estreia (conta aberta dentro dele) com vencido dos dois
       lados: os quatro termos-ponte entram com sinais opostos, e a
       identidade tem que sobreviver a isso. */
    it("sobrevive aos termos-ponte com sinais opostos", () => {
        const report = aMonthReport({
            OpeningBalance: 0,
            InitialBalances: 1500.33,
            PastCommitments: 980.66,
            OverdueReceivable: 12.01,
            OverduePayable: 777.77,
            //  0 + 1500,33 − 980,66 + 10226 − 5508,07 + 12,01 − 777,77
            Available: 4471.84,
        });

        expect(budgetChain(report).available).toBe(report.Available);
        //  E o que sobra é a última linha mais o avulso já gasto
        expect(budgetChain(report).free).toBe(4725.91);
    });

    /* Enquanto a rota não respondeu não há cadeia, e os três são zero: é a
       tela que decide mostrar traço, porque um zero aqui seria um número —
       e errado. */
    it("devolve zeros sem resposta nenhuma", () => {
        expect(budgetChain(undefined)).toEqual({ adjustments: 0, free: 0, available: 0 });
    });
});
