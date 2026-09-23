import { errorMessage } from "@/api/client";
import { payInvoice as request } from "@/app/payInvoice";
import type { StatementContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Quitar — ou desquitar — a fatura DESTE BLOCO do extrato.
 *
 *  É o mesmo gesto da tela da Fatura, com outro recorte: lá o ciclo é o
 *  que as setas escolheram, aqui é o que VENCE no mês do seletor. Por
 *  isso as duas telas dividem o corpo em `@/app/payInvoice` — uma
 *  segunda redação da mensagem ou do corpo da requisição seria duas
 *  respostas para a mesma pergunta.
 *
 *  **O `DueDate` é o do próprio bloco**, que veio recortado pelo
 *  servidor em `GET /Reports/Statement`: `Cards` já é o par
 *  `(cartão, vencimento)`. É o MESMO recorte que o `payInvoice` faz na
 *  escrita, e é isso que impede o botão de mandar um vencimento cujos
 *  lançamentos ele nunca mostrou. */
export async function payInvoice(
    context: StatementContext,
    card: ApiTypes.StatementCard,
    undo = false,
): Promise<void> {
    context.beginPay();

    try {
        context.finishPay(
            await request({ IdPaymentMethod: card.IdPaymentMethod, DueDate: card.DueDate }, undo),
        );
    } catch (cause) {
        /* Nada mudou no servidor, então não há cache a invalidar — e a
           `msg` do 406 já chega pronta para a tela. */
        context.failPay(errorMessage(cause));
    }
}
