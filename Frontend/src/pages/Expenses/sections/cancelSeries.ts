import { errorMessage } from "@/api/client";
import { ExpensesConnection } from "@/api/Expenses.connection";
import type { ExpensesContext } from "../controller";

/** Encerrar uma série de gasto fixo, desta ocorrência para a frente.
 *
 *  O corte é a DATA da ocorrência chamada, não o relógio: o que já
 *  passou fica como está, porque aconteceu. A resposta diz quantas
 *  linhas foram canceladas, e esse número vale ser mostrado — encerrar
 *  uma série é a ação de maior alcance da tela. */
export async function cancelSeries(context: ExpensesContext, idExpense: number): Promise<void> {
    context.beginSubmit();

    try {
        const { Canceled } = await ExpensesConnection.cancelSeries(idExpense);
        context.closeDetail();
        context.finishSubmit(
            `Série encerrada — ${Canceled} ocorrência${Canceled === 1 ? "" : "s"} cancelada${Canceled === 1 ? "" : "s"}.`,
        );
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
