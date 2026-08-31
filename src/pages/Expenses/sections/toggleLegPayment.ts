import { errorMessage } from "@/api/client";
import { ExpensePaymentsConnection } from "@/api/ExpensePayments.connection";
import type { ExpensesContext } from "../controller";

/** Quitar ou desquitar uma perna.
 *
 *  A perna é a unidade que MOVE SALDO — não o gasto. Quitar 1 de 6
 *  parcelas tira 100 da conta e deixa a compra ainda `pending`: o
 *  `Status` do gasto só vira `paid` quando TODAS as pernas estão pagas,
 *  e quem recalcula isso é a API, na mesma transaction.
 *
 *  `unpay` existe porque um clique errado, sem ele, tiraria dinheiro da
 *  conta sem volta.
 *
 *  Nenhuma das duas rotas tem corpo: o instante do pagamento quem grava
 *  é o servidor. */
export async function toggleLegPayment(
    context: ExpensesContext,
    idExpensePayment: number,
    paid: boolean,
): Promise<void> {
    context.beginSubmit();

    try {
        if (paid) {
            await ExpensePaymentsConnection.unpay(idExpensePayment);
            context.finishSubmit("Parcela desquitada — o dinheiro voltou ao saldo.");
        } else {
            await ExpensePaymentsConnection.pay(idExpensePayment);
            context.finishSubmit("Parcela quitada.");
        }
    } catch (cause) {
        // 406 quando a perna não existe, o gasto está cancelado ou a
        // parcela já está quitada — os três com `msg` pronta.
        context.failSubmit(errorMessage(cause));
    }
}
