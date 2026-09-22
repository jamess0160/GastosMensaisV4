import { describe, expect, it } from "vitest";
import { openInvoice } from "../sections/openInvoice";
import { aCard, fakeExpensesContext } from "./context";

describe("openInvoice", () => {
    it("vai DIRETO quando há um cartão só", () => {
        const context = fakeExpensesContext();

        openInvoice(context, [aCard({ IdPaymentMethod: 12 })]);

        // Uma escolha de um item é um clique que só tem uma saída
        // possível — e a maioria das pessoas tem um cartão.
        expect(context.openInvoiceFor).toHaveBeenCalledWith(12);
        expect(context.openCardChoice).not.toHaveBeenCalled();
    });

    it("abre a escolha quando há mais de um", () => {
        const context = fakeExpensesContext();

        openInvoice(context, [
            aCard({ IdPaymentMethod: 12 }),
            aCard({ IdPaymentMethod: 13, Name: "Cartão Azul" }),
        ]);

        // Dois cartões são duas faturas diferentes: abrir "a primeira"
        // levaria à fatura errada sem dizer que escolheu por ela.
        expect(context.openCardChoice).toHaveBeenCalledOnce();
        expect(context.openInvoiceFor).not.toHaveBeenCalled();
    });
});
