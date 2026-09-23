import { goToCycle, goToDue, goToOpenCycle } from "./sections/goToCycle";
import { payInvoice } from "./sections/payInvoice";
import type { ApiTypes } from "@/types/api";

/** O contexto da tela da fatura.
 *
 *  Dois verbos, e eles são as duas coisas que a tela faz: trocar o
 *  CICLO exibido e QUITAR o ciclo que está nela. `null` em `due` é a
 *  fatura ABERTA — a ausência de `DueDate` na requisição, que é a
 *  pergunta "qual está aberta hoje?" feita a quem sabe respondê-la. */
export interface InvoiceContext {
    /** O vencimento exibido, ou `null` para a aberta. */
    due: ApiTypes.CalendarDate | null;
    showCycle(due: ApiTypes.CalendarDate | null): void;
    /** Entra em "quitando", e limpa o erro e o aviso anteriores. */
    beginPay(): void;
    failPay(message: string): void;
    /** O fim de uma quitação, e ele é mais que guardar a mensagem: é
     *  aqui que o MOVIMENTO DO MÊS INTEIRO é invalidado.
     *
     *  Uma fatura mexe em dezenas de pernas de uma vez — o saldo da
     *  conta (somado a cada leitura), os indicadores do Início, o
     *  extrato e o `Status` de dezenas de gastos mudam todos juntos. E
     *  em todos os meses em cache, não só no exibido: um parcelado tem
     *  perna em doze faturas. Nada disso é recalculado aqui; o que se
     *  faz é mandar reler. */
    finishPay(message: string): void;
}

class Controller {
    readonly goToCycle = goToCycle;
    readonly goToDue = goToDue;
    readonly goToOpenCycle = goToOpenCycle;
    readonly payInvoice = payInvoice;
}

export const InvoiceController = new Controller();
