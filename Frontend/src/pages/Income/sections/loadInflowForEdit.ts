import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext, InflowDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Traduz a entrada que veio da API para o rascunho do formulário. */
export function toDraft(inflow: ApiTypes.Inflow): InflowDraft {
    return {
        IdInflow: inflow.IdInflow,
        Description: inflow.Description,
        TotalValue: inflow.TotalValue,
        Kind: inflow.Kind,
        IdFromAccount: inflow.IdFromAccount,
        IdToAccount: inflow.IdToAccount,
        CompetenceDate: inflow.CompetenceDate,
        ExpectedDate: inflow.ExpectedDate,
        Notes: inflow.Notes ?? "",
        received: inflow.Status === "received",
    };
}

/** Carrega uma entrada para edição.
 *
 *  Continua pedindo `GET /Inflows/:id` mesmo agora que ele devolve o
 *  mesmo que a lista — e por um motivo melhor do que o de antes: reler a
 *  entrada antes de editar é o que evita salvar em cima de uma versão
 *  velha do cache. */
export async function loadInflowForEdit(context: IncomeContext, idInflow: number): Promise<void> {
    context.beginSubmit();

    try {
        const inflow = await InflowsConnection.get(idInflow);
        context.setDraft(toDraft(inflow));
        context.finishSubmit("");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
