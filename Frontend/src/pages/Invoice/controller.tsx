import { goToCycle, goToDue, goToOpenCycle } from "./sections/goToCycle";
import type { ApiTypes } from "@/types/api";

/** O contexto da tela da fatura.
 *
 *  Um verbo só, e ele é o que a tela inteira faz: trocar o CICLO
 *  exibido. `null` é a fatura ABERTA — a ausência de `DueDate` na
 *  requisição, que é a pergunta "qual está aberta hoje?" feita a quem
 *  sabe respondê-la. */
export interface InvoiceContext {
    /** O vencimento exibido, ou `null` para a aberta. */
    due: ApiTypes.CalendarDate | null;
    showCycle(due: ApiTypes.CalendarDate | null): void;
}

class Controller {
    readonly goToCycle = goToCycle;
    readonly goToDue = goToDue;
    readonly goToOpenCycle = goToOpenCycle;
}

export const InvoiceController = new Controller();
