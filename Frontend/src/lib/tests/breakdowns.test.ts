import { describe, expect, it } from "vitest";
import { paymentLegs, spentByPaymentMethod, spentByPerson } from "../aggregate";
import { aLegRow, anExpense, anExpensePerson, installmentRows } from "./factories";

/* As duas quebras que o Início desenha ao lado da de categoria.
   Nenhuma delas depende mais do `get(id)` de cada gasto: a forma de
   pagamento é da própria perna, e o rateio vem junto com ela.

   O CUIDADO que sobrou é o oposto do de antes. O `Persons` da perna é o
   do GASTO: numa compra de 600 em 6×, as seis pernas trazem os mesmos
   600 — somar perna a perna dá 3600 e NADA estoura, o número só fica
   errado. É por isso que estas duas contas têm teste próprio. */

describe("spentByPaymentMethod", () => {
    it("soma a perna pela forma dela — 600 em 6x no cartão 7 custa 100 ao mês", () => {
        const rows = installmentRows({ IdExpense: 1, total: 600, parts: 6, IdPaymentMethod: 7 });
        const legs = paymentLegs(rows.filter((row) => row.CompetenceDate.startsWith("2026-08")));

        expect(spentByPaymentMethod(legs)).toEqual([{ IdPaymentMethod: 7, value: 100 }]);
    });

    it("um gasto pago com duas formas vira duas pernas, uma em cada", () => {
        // Metade no pix, metade no débito: o eixo financeiro é rateio, e
        // é por isso que a fatia não precisa de mais nada além da perna.
        const expense = anExpense({ IdExpense: 2, TotalValue: 100 });
        const legs = paymentLegs([
            aLegRow(expense, { IdExpensePayment: 1, IdPaymentMethod: 3, Value: 60 }),
            aLegRow(expense, { IdExpensePayment: 2, IdPaymentMethod: 4, Value: 40 }),
        ]);

        expect(spentByPaymentMethod(legs)).toEqual([
            { IdPaymentMethod: 3, value: 60 },
            { IdPaymentMethod: 4, value: 40 },
        ]);
    });

    it("não conta a perna de gasto cancelado", () => {
        const legs = paymentLegs([
            aLegRow(anExpense({ IdExpense: 3, TotalValue: 999, Status: "canceled" })),
        ]);

        expect(spentByPaymentMethod(legs)).toEqual([]);
    });
});

describe("spentByPerson", () => {
    it("rateia a PERNA na proporção do rateio da compra", () => {
        // 600 em 6x divididos meio a meio: cada pessoa tem 300 gravados
        // na compra, e agosto custa 50 a cada uma — não 300.
        const rows = installmentRows({
            IdExpense: 1,
            total: 600,
            parts: 6,
            persons: [anExpensePerson(10, 300), anExpensePerson(20, 300)],
        });
        const legs = paymentLegs(rows.filter((row) => row.CompetenceDate.startsWith("2026-08")));

        expect(spentByPerson(legs)).toEqual([
            { IdPerson: 10, value: 50 },
            { IdPerson: 20, value: 50 },
        ]);
    });

    it("as seis pernas somadas dão a compra inteira, e não seis vezes ela", () => {
        // O erro que a rota nova torna possível: `Persons` vem igual em
        // toda perna. Sem o rateio, isto daria 3600.
        const rows = installmentRows({
            IdExpense: 1,
            total: 600,
            parts: 6,
            persons: [anExpensePerson(10, 600)],
        });

        expect(spentByPerson(paymentLegs(rows))).toEqual([{ IdPerson: 10, value: 600 }]);
    });

    it("fecha com o valor da perna mesmo quando a divisão não é exata", () => {
        const expense = anExpense({ IdExpense: 5, TotalValue: 100 });
        const legs = paymentLegs([
            aLegRow(expense, { Value: 100 }, [
                anExpensePerson(10, 33.33, 5),
                anExpensePerson(20, 33.33, 5),
                anExpensePerson(30, 33.34, 5),
            ]),
        ]);

        const sum = spentByPerson(legs).reduce(
            (acc, slice) => acc + Math.round(slice.value * 100),
            0,
        );

        expect(sum).toBe(10000);
    });

    it("junta em `null` o gasto sem rateio — que é a maioria", () => {
        const legs = paymentLegs([aLegRow(anExpense({ IdExpense: 7, TotalValue: 100 }))]);

        expect(spentByPerson(legs)).toEqual([{ IdPerson: null, value: 100 }]);
    });
});
