import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext } from "../controller";

/** Cancelar uma entrada.
 *
 *  O DELETE cancela: o `Status` vira `canceled` e a linha fica. Não há
 *  delete físico nem coluna `Active` nesta tabela — o histórico de
 *  dinheiro não se apaga.
 *
 *  Cancelar uma entrada JÁ RECEBIDA tira o dinheiro do saldo, que é o
 *  espelho do estorno do gasto. A tela confirma dizendo isso. */
export async function cancelInflow(context: IncomeContext, idInflow: number): Promise<void> {
    context.beginSubmit();

    try {
        await InflowsConnection.cancel(idInflow);
        context.closeDetail();
        context.finishSubmit("Entrada cancelada.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
