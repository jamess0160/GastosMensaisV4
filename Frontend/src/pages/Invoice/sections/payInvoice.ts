import { errorMessage } from "@/api/client";
import { payInvoice as request } from "@/app/payInvoice";
import type { InvoiceContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Quitar — ou desquitar — a fatura QUE ESTÁ NA TELA.
 *
 *  É o gesto que faltava: `POST /payInvoice` existe desde a leva 6, mas
 *  só tinha botão no card do cartão em Contas, recortado pelo mês do
 *  chassi. Enquanto isso a tela de Gastos recusa quitar perna de cartão
 *  (406, "perna de cartão de crédito é quitada com a fatura") — então a
 *  única operação que faz o saldo do cartão descer não tinha botão na
 *  tela em que a fatura aparece inteira.
 *
 *  **O `DueDate` vem da RESPOSTA, não do `context.due`.** Os dois
 *  discordam exatamente no caso mais comum: na fatura aberta o estado da
 *  tela é `null`, que é a ausência de `DueDate` na LEITURA — a pergunta
 *  "qual está aberta hoje?". Mandar essa ausência para a ESCRITA seria
 *  pedir ao servidor que decidisse de novo, entre a leitura e o clique,
 *  qual fatura quitar; na virada do ciclo ele decidiria outra, e o
 *  dinheiro sairia do ciclo errado.
 *
 *  O corpo da requisição e a frase da resposta moram no chassi
 *  (`@/app/payInvoice`), compartilhados com o bloco do cartão no
 *  Extrato: são o mesmo `payInvoice` visto de dois recortes. */
export async function payInvoice(
    context: InvoiceContext,
    invoice: ApiTypes.Invoice,
    undo = false,
): Promise<void> {
    context.beginPay();

    try {
        context.finishPay(
            await request(
                { IdPaymentMethod: invoice.IdPaymentMethod, DueDate: invoice.DueDate },
                undo,
            ),
        );
    } catch (cause) {
        /* 406 quando a forma não é cartão de crédito ou quando não há
           fatura com esse vencimento — fatura sem perna nenhuma não é
           fatura paga, é fatura que não existe. O erro NÃO passa pelo
           `finishPay`: nada mudou no servidor, então não há cache a
           invalidar, e invalidar assim mesmo mandaria a tela inteira
           recarregar para mostrar o mesmo número. */
        context.failPay(errorMessage(cause));
    }
}
