import { PaymentMethodsConnection } from "@/api/PaymentMethods.connection";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   QUITAR A FATURA — o corpo compartilhado.

   **É esta ação que faz o saldo do cartão descer.** No crédito, marcar
   uma compra como paga não tira dinheiro de conta nenhuma: quem tira é
   o pagamento da fatura, semanas depois. A tela de Gastos recusa quitar
   perna de cartão de propósito — a API responde 406 com "perna de
   cartão de crédito é quitada com a fatura" —, e é isso que torna este
   gesto o ÚNICO caminho para o dinheiro sair. Uma fatura de cartão
   concentrador tem 40 compras: ninguém marca 40.

   Ele mora no chassi pelo mesmo motivo que a exportação de planilha
   (`exportSpreadsheet.ts`): sai de DOIS lugares com dois recortes —

     tela da Fatura   →  o ciclo que a navegação por ‹ › escolheu
     bloco do Extrato →  o ciclo que vence no mês do seletor

   — e uma segunda redação da mensagem ou do corpo da requisição seria
   duas respostas para a mesma pergunta. Cada tela tem a sua section,
   que chama isto aqui com o seu alvo.

   A FATURA NÃO É UM CADASTRO, É UMA CONSULTA. Não há tabela nem id de
   fatura: todas as pernas de um ciclo compartilham o mesmo `DueDate`
   exato, então uma fatura é `(IdPaymentMethod, DueDate)`. Esse
   vencimento vem SEMPRE da resposta do servidor — nunca de uma conta de
   ciclo feita no cliente, que discordaria dele no dia do fechamento.
   ════════════════════════════════════════════════════════════ */

/** A fatura a quitar, que é tudo que uma fatura é neste modelo. */
export interface InvoiceTarget {
    IdPaymentMethod: number;
    /** O vencimento do ciclo EM TELA, como o servidor o devolveu.
     *
     *  Nunca `null`: "a fatura aberta" é uma pergunta de LEITURA (a
     *  requisição sem `DueDate`), e a resposta dela traz o vencimento
     *  concreto. Mandar a ausência para a escrita seria pedir ao
     *  servidor que decidisse de novo, entre a leitura e o clique, qual
     *  fatura quitar — e na virada do ciclo ele decidiria outra. */
    DueDate: ApiTypes.CalendarDate;
}

/** Quita, ou desfaz a quitação, da fatura inteira — e devolve a frase
 *  que a tela mostra.
 *
 *  REPETIR É INOFENSIVO: pernas já pagas são puladas, e `Payments: 0` é
 *  resposta legítima ("a fatura já estava assim"). É isso que resolve o
 *  caso real de lançar hoje uma compra esquecida que pertence a uma
 *  fatura já paga — chame de novo e só a que faltava é quitada. Pernas
 *  de gasto cancelado ficam de fora.
 *
 *  `Payments` é QUANTAS PERNAS mudaram de estado, e a mensagem o diz
 *  porque ele é o número que o usuário confere contra o extrato do
 *  banco: "12 lançamentos saíram do saldo" é verificável, "pronto" não.
 *
 *  406 se a forma não existe no workspace, não é `credit_card`, ou não
 *  há fatura com esse vencimento — fatura sem perna nenhuma não é
 *  fatura paga, é fatura que não existe. */
export async function payInvoice(target: InvoiceTarget, undo = false): Promise<string> {
    const body = { DueDate: target.DueDate };

    const { Payments } = undo
        ? await PaymentMethodsConnection.unpayInvoice(target.IdPaymentMethod, body)
        : await PaymentMethodsConnection.payInvoice(target.IdPaymentMethod, body);

    const one = Payments === 1;
    const count = `${Payments} lançamento${one ? "" : "s"}`;

    if (undo) {
        return Payments === 0
            ? "Esta fatura não estava quitada — nada mudou."
            : `Quitação desfeita — ${count} ${one ? "voltou" : "voltaram"} ao saldo.`;
    }

    return Payments === 0
        ? "Esta fatura já estava quitada — nada mudou."
        : `Fatura quitada — ${count} ${one ? "saiu" : "saíram"} do saldo.`;
}

/** O rótulo do botão, e ele DIZ O QUE A FATURA É.
 *
 *  Pagar uma fatura ainda aberta é legítimo e acontece — adiantamento,
 *  ou o pagamento que já foi feito no app do banco e só falta registrar
 *  aqui. Esconder o botão até o fechamento obrigaria a esperar para
 *  registrar um fato que já aconteceu; então ele aparece, com a ressalva
 *  entre parênteses, e quem clica sabe que o ciclo ainda vai receber
 *  compras.
 *
 *  O `Status` é DERIVADO PELA API e não se recalcula aqui: comparar
 *  "hoje" com o fechamento no cliente usaria o relógio do navegador, que
 *  o usuário mexe. E `paid` ganha dos outros dois — uma fatura quitada
 *  adiantada continua paga. */
export const INVOICE_ACTION_LABEL: Record<ApiTypes.InvoiceStatus, string> = {
    open: "Quitar fatura (ainda aberta)",
    closed: "Quitar fatura",
    paid: "Desfazer quitação",
};

/** A confirmação de DESFAZER, numa redação só para as duas telas.
 *
 *  Só o desfazer confirma, e a assimetria é de propósito: quitar
 *  registra um pagamento que a pessoa acabou de fazer, e errar custa um
 *  clique em "Desfazer quitação". Desfazer devolve dezenas de
 *  lançamentos ao saldo de um mês que pode já estar fechado — e esse
 *  número reaparece no Início, no Relatório e no extrato do mês inteiro
 *  de uma vez. */
export const UNPAY_CONFIRM = {
    title: (name: string) => `Desfazer a quitação da fatura de ${name}?`,
    description:
        "Todos os lançamentos dessa fatura voltam a pesar no saldo da conta — podem ser dezenas de uma vez. Nenhum gasto é apagado: o que muda é só o estado da fatura.",
    confirmLabel: "Desfazer quitação",
};
