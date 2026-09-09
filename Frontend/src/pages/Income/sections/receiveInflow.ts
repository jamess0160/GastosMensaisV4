import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext } from "../controller";

/** Confirmar o recebimento.
 *
 *  É ISTO que põe o dinheiro no saldo — criar a entrada não põe. E é
 *  TUDO OU NADA: não existe recebimento parcial nem `ReceivedValue` no
 *  contrato, então a tela não oferece "recebi metade".
 *
 *  A rota não tem corpo: o instante do recebimento quem grava é o
 *  servidor. */
export async function receiveInflow(context: IncomeContext, idInflow: number): Promise<void> {
    context.beginSubmit();

    try {
        await InflowsConnection.receive(idInflow);
        context.finishSubmit("Recebimento confirmado — o dinheiro entrou no saldo da conta.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
