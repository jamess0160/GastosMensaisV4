import { errorMessage } from "@/api/client";
import { ExpensePaymentsConnection } from "@/api/ExpensePayments.connection";
import { isCardLeg } from "@/lib/card";
import type { ExpensesContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** O botão de estado de uma perna — e ele afirma DUAS coisas
 *  diferentes, conforme a forma de pagamento.
 *
 *  **Fora do cartão**, `pay`/`unpay`: a perna é a unidade que MOVE
 *  SALDO. Quitar 1 de 6 parcelas de um carnê tira 100 da conta e deixa a
 *  compra ainda `pending` — o `Status` do gasto só vira `paid` quando
 *  TODAS as pernas estão pagas, e quem recalcula isso é a API, na mesma
 *  transaction.
 *
 *  **No cartão**, `charge`/`uncharge`: marcar uma compra isolada como
 *  paga não tira dinheiro de conta nenhuma — quem tira é o pagamento da
 *  fatura, semanas depois, e é por isso que `pay` responde 406 aqui. O
 *  que a linha afirma é outra coisa: "a cobrança entrou na fatura, e no
 *  valor certo". Quem quita é "Quitar fatura", na tela de Contas.
 *
 *  Quem separa os dois casos é `Charged`, que é `null` fora do cartão —
 *  a perna não carrega o `Kind` da forma de pagamento, e essa nulidade é
 *  exatamente o sinal que o contrato desenhou para isto.
 *
 *  Nenhuma das quatro rotas tem corpo: o instante quem grava é o
 *  servidor. */
export async function toggleLegPayment(
    context: ExpensesContext,
    payment: ApiTypes.ExpensePayment,
): Promise<void> {
    context.beginSubmit();

    const { IdExpensePayment } = payment;

    try {
        if (isCardLeg(payment)) {
            if (payment.Charged) {
                await ExpensePaymentsConnection.uncharge(IdExpensePayment);
                context.finishSubmit("Cobrança desmarcada da fatura.");
            } else {
                await ExpensePaymentsConnection.charge(IdExpensePayment);
                context.finishSubmit(
                    "Marcada como lançada na fatura — o saldo só desce quando a fatura for quitada.",
                );
            }
            return;
        }

        if (payment.Paid) {
            await ExpensePaymentsConnection.unpay(IdExpensePayment);
            context.finishSubmit("Parcela desquitada — o dinheiro voltou ao saldo.");
        } else {
            await ExpensePaymentsConnection.pay(IdExpensePayment);
            context.finishSubmit("Parcela quitada.");
        }
    } catch (cause) {
        // 406 quando a perna não existe, o gasto está cancelado, a
        // parcela já está no estado pedido — ou quando se tenta `pay`
        // numa perna de cartão, com a `msg` apontando o `payInvoice`.
        context.failSubmit(errorMessage(cause));
    }
}
