import { errorMessage } from "@/api/client";
import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import type { AccountsContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Quitar (ou desquitar) a fatura de um cartão.
 *
 *  **É esta ação que faz o saldo descer.** No cartão, marcar uma compra
 *  como paga não tira dinheiro de conta nenhuma — quem tira é o
 *  pagamento da fatura, semanas depois. Como só existia o `pay` de uma
 *  perna por vez, ninguém marcava as 40 compras de uma fatura: elas
 *  ficavam pendentes para sempre e o saldo nunca descia.
 *
 *  A FATURA NÃO É UM CADASTRO, É UMA CONSULTA. Não há tabela nem id de
 *  fatura: todas as pernas de um ciclo compartilham o mesmo `DueDate`
 *  exato, então uma fatura é `(IdPaymentMethod, DueDate)`. O `DueDate`
 *  que vai aqui é o do ciclo — calculado em `src/lib/card.ts` a partir
 *  do `DueDay` do cartão, que é a mesma conta que o servidor fez ao
 *  gravar cada perna.
 *
 *  REPETIR É INOFENSIVO: pernas já pagas são puladas, e `Payments: 0` é
 *  resposta legítima ("a fatura já estava assim"). É isso que resolve o
 *  caso real de lançar hoje uma compra esquecida que pertence a uma
 *  fatura já paga — chame de novo e só a que faltava é quitada.
 *
 *  O desfazer não é luxo: um clique errado aqui tira dezenas de
 *  pagamentos do saldo de uma vez. */
export async function payInvoice(
    context: AccountsContext,
    idPaymentMethod: number,
    DueDate: ApiTypes.CalendarDate,
    undo = false,
): Promise<void> {
    context.beginSubmit();

    try {
        const { Payments } = undo
            ? await PaymentMethodsConnection.unpayInvoice(idPaymentMethod, { DueDate })
            : await PaymentMethodsConnection.payInvoice(idPaymentMethod, { DueDate });

        const plural = Payments === 1 ? "" : "s";

        context.finishInvoice(
            undo
                ? `Quitação desfeita — ${Payments} lançamento${plural} voltou ao saldo.`
                : Payments === 0
                  ? "Esta fatura já estava quitada — nada mudou."
                  : `Fatura quitada — ${Payments} lançamento${plural} saiu do saldo.`,
        );
    } catch (cause) {
        // 406 quando a forma não é cartão de crédito ou quando não há
        // fatura com esse vencimento: fatura sem perna nenhuma não é
        // fatura paga, é fatura que não existe.
        context.failSubmit(errorMessage(cause));
    }
}
