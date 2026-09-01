import { describe, expect, it } from "vitest";
import { monthLegs, spentByPaymentMethod, spentByPerson } from "../aggregate";
import { anExpense, anExpenseDetail, anInstallment, aPayment } from "./factories";
import type { ApiTypes } from "@/types/api";

/* As duas quebras que o Início desenha ao lado da de categoria. Ambas
   dependem do DETALHE do gasto — a lista não traz `Payments` nem
   `Persons` —, e é justamente por isso que elas têm teste próprio: o
   caminho em que o detalhe ainda não chegou não pode virar número
   errado, só número ausente. */

const lookup = (details: ApiTypes.ExpenseDetail[]) => (idExpense: number) =>
    details.find((detail) => detail.IdExpense === idExpense);

describe("spentByPaymentMethod", () => {
    it("soma a perna pela forma dela quando a perna veio do detalhe", () => {
        // 600 em 6x no cartão 7: agosto custa 100, não 600.
        const installment = anInstallment({ IdExpense: 1, total: 600, parts: 6 });
        installment.Payments = installment.Payments.map((payment) => ({
            ...payment,
            IdPaymentMethod: 7,
        }));

        const legs = monthLegs("2026-08", [], [installment]);
        const result = spentByPaymentMethod(legs, lookup([installment]));

        expect(result).toEqual([{ IdPaymentMethod: 7, value: 100 }]);
    });

    it("abre a perna implícita da lista nas formas do detalhe", () => {
        // Um gasto à vista de 100 pago metade no pix, metade no débito:
        // a lista traz uma linha só, e as duas formas só existem no
        // detalhe.
        const expense = anExpense({ IdExpense: 2, TotalValue: 100 });
        const detail = anExpenseDetail({
            ...expense,
            Payments: [
                aPayment({ IdExpensePayment: 1, IdExpense: 2, IdPaymentMethod: 3, Value: 60 }),
                aPayment({ IdExpensePayment: 2, IdExpense: 2, IdPaymentMethod: 4, Value: 40 }),
            ],
        });

        const legs = monthLegs("2026-08", [expense]);
        const result = spentByPaymentMethod(legs, lookup([detail]));

        expect(result).toEqual([
            { IdPaymentMethod: 3, value: 60 },
            { IdPaymentMethod: 4, value: 40 },
        ]);
    });

    it("deixa de fora o gasto cujo detalhe ainda não chegou", () => {
        // Uma fatia "desconhecido" que encolhe sozinha em três segundos
        // é pior do que uma fatia que aparece quando o dado chega.
        const expense = anExpense({ IdExpense: 3 });
        const legs = monthLegs("2026-08", [expense]);

        expect(spentByPaymentMethod(legs, () => undefined)).toEqual([]);
    });
});

describe("spentByPerson", () => {
    it("rateia a PERNA na proporção do rateio da compra", () => {
        // 600 em 6x divididos meio a meio: cada pessoa tem 300 gravados
        // na compra, e agosto custa 50 a cada uma — não 300.
        const installment = anInstallment({ IdExpense: 1, total: 600, parts: 6 });
        installment.Persons = [
            {
                IdExpensePerson: 1,
                IdWorkspace: 1,
                IdExpense: 1,
                IdPerson: 10,
                Value: 300,
                CreatedAt: "",
                UpdatedAt: "",
            },
            {
                IdExpensePerson: 2,
                IdWorkspace: 1,
                IdExpense: 1,
                IdPerson: 20,
                Value: 300,
                CreatedAt: "",
                UpdatedAt: "",
            },
        ];

        const legs = monthLegs("2026-08", [], [installment]);
        const result = spentByPerson(legs, lookup([installment]));

        expect(result).toEqual([
            { IdPerson: 10, value: 50 },
            { IdPerson: 20, value: 50 },
        ]);
    });

    it("fecha com o valor da perna mesmo quando a divisão não é exata", () => {
        const expense = anExpense({ IdExpense: 5, TotalValue: 100 });
        const detail = anExpenseDetail({
            ...expense,
            Payments: [aPayment({ IdExpense: 5, Value: 100 })],
            Persons: [
                {
                    IdExpensePerson: 1,
                    IdWorkspace: 1,
                    IdExpense: 5,
                    IdPerson: 10,
                    Value: 33.33,
                    CreatedAt: "",
                    UpdatedAt: "",
                },
                {
                    IdExpensePerson: 2,
                    IdWorkspace: 1,
                    IdExpense: 5,
                    IdPerson: 20,
                    Value: 33.33,
                    CreatedAt: "",
                    UpdatedAt: "",
                },
                {
                    IdExpensePerson: 3,
                    IdWorkspace: 1,
                    IdExpense: 5,
                    IdPerson: 30,
                    Value: 33.34,
                    CreatedAt: "",
                    UpdatedAt: "",
                },
            ],
        });

        const legs = monthLegs("2026-08", [expense]);
        const result = spentByPerson(legs, lookup([detail]));
        const sum = result.reduce((acc, slice) => acc + Math.round(slice.value * 100), 0);

        expect(sum).toBe(10000);
    });

    it("junta em `null` o gasto sem rateio — que é a maioria", () => {
        const expense = anExpense({ IdExpense: 7, TotalValue: 100 });
        const detail = anExpenseDetail({ ...expense, Persons: [] });

        const legs = monthLegs("2026-08", [expense]);

        expect(spentByPerson(legs, lookup([detail]))).toEqual([{ IdPerson: null, value: 100 }]);
    });
});
