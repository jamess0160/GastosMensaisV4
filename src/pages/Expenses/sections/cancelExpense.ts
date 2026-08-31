import { errorMessage } from "@/api/client";
import { ExpensesConnection } from "@/api/Expenses.connection";
import type { ExpensesContext } from "../controller";

/** Cancelar um gasto.
 *
 *  Não é delete: o `Status` vira `canceled` e a linha continua no
 *  histórico. E cancelar um gasto JÁ PAGO é o estorno — o dinheiro volta
 *  ao saldo da conta. Por isso a tela confirma antes, dizendo o que vai
 *  acontecer com o dinheiro, e não só "tem certeza?".
 *
 *  Gasto já cancelado responde 406. */
export async function cancelExpense(context: ExpensesContext, idExpense: number): Promise<void> {
    context.beginSubmit();

    try {
        await ExpensesConnection.cancel(idExpense);
        context.closeDetail();
        context.finishSubmit("Gasto cancelado.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
