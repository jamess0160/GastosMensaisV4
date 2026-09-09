import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext, InflowDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Traduz a entrada que veio da API para o rascunho do formulário.
 *
 *  Só o `get(id)` traz `Persons` — a lista do mês não desenha rateio e
 *  não o carrega. */
export function toDraft(inflow: ApiTypes.InflowDetail): InflowDraft {
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
        persons: inflow.Persons.map((person) => ({
            id: person.IdPerson,
            value: person.Value,
        })),
        received: inflow.Status === "received",
    };
}

/** Carrega uma entrada para edição. */
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
