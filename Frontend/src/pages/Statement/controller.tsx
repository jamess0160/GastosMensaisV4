import { payInvoice } from "./sections/payInvoice";

/** O que a tela entrega aos eventos.
 *
 *  O extrato era leitura pura — não quitava, não conciliava e não
 *  marcava nada — e ganhou UM evento: quitar a fatura do cartão. Ele não
 *  desmente a tela, confirma: a fatura já está ali aberta, com o ciclo
 *  inteiro e o total, e era o único lugar do app em que ela aparecia
 *  assim sem ter o botão que faz o saldo descer. Navegar até o
 *  lançamento continua sendo do roteador, não um evento de negócio.
 *
 *  Quem invalida o cache é o `finishPay` — ver o contexto da tela da
 *  Fatura, que declara o mesmo par de verbos pelo mesmo motivo. */
export interface StatementContext {
    /** Entra em "quitando", e limpa o erro e o aviso anteriores. */
    beginPay(): void;
    failPay(message: string): void;
    /** Guarda a mensagem E invalida o movimento do mês inteiro: o saldo
     *  da conta, o próprio extrato e os indicadores de Gastos mudam
     *  todos juntos, e nenhum deles é recalculado aqui. */
    finishPay(message: string): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly payInvoice = payInvoice;
}

export const StatementController = new Controller();
