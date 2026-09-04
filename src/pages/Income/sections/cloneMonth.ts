import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import { addMonthsToDate } from "@/lib/date";
import type { IncomeContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Clonar o mês anterior.

   O que se repete todo mês é a renda: salário, aluguel recebido, a
   mesada. Redigitar isso — com o rateio — é o trabalho mais chato da
   tela, e era o botão desabilitado que o layout desenhava.

   A ESCOLHA É DO USUÁRIO. A tela lista o mês anterior e ele marca o que
   quer trazer; nada é adivinhado. Isso resolve de graça o problema que
   travava a versão "clonar tudo": não há repetição silenciosa a evitar,
   porque cada linha foi escolhida à mão.

   O QUE O CLIENTE FAZ, E O QUE NÃO FAZ. Ele lista, deixa escolher,
   busca o rateio de cada escolhida (a lista não traz `Persons`), avança
   as datas e monta os corpos. Gravar é UMA chamada — `POST
   /Inflows/batch`, pendência 15 —, porque atomicidade é do banco: com
   um POST por entrada, a terceira recusada deixaria o mês pela metade e
   sem como voltar atrás.
   ════════════════════════════════════════════════════════════ */

/** As entradas que valem a pena clonar: renda, não transferência, e
 *  nada de cancelada.
 *
 *  Transferência fica de fora porque ela não é renda que se repete — é
 *  dinheiro trocando de bolso num dia específico, e clonar isso moveria
 *  saldo entre contas sem que ninguém tivesse pedido. */
export const clonable = (inflows: readonly ApiTypes.Inflow[]): ApiTypes.Inflow[] =>
    inflows.filter((inflow) => inflow.Kind === "inflow" && inflow.Status !== "canceled");

/** Uma entrada do mês anterior vira o corpo da cópia deste mês.
 *
 *  As duas datas andam um mês com o dia aparado (`addMonthsToDate`): um
 *  salário do dia 31 vira 28/02, nunca 03/03. `Status` não vai no corpo
 *  — toda cópia nasce pendente, e é o `receive` de cada uma que move
 *  saldo. É isso que torna a operação segura mesmo quando o usuário
 *  clona sem prestar atenção. */
export function cloneBody(detail: ApiTypes.InflowDetail): ApiTypes.InflowCreateBody {
    return {
        Description: detail.Description,
        TotalValue: detail.TotalValue,
        Kind: "inflow",
        IdFromAccount: null,
        IdToAccount: detail.IdToAccount,
        CompetenceDate: addMonthsToDate(detail.CompetenceDate, 1),
        ExpectedDate: detail.ExpectedDate === null ? null : addMonthsToDate(detail.ExpectedDate, 1),
        Notes: detail.Notes,
        ...(detail.Persons.length > 0
            ? {
                  Persons: detail.Persons.map((person) => ({
                      IdPerson: person.IdPerson,
                      Value: person.Value,
                  })),
              }
            : {}),
    };
}

export async function cloneMonth(
    context: IncomeContext,
    chosen: readonly ApiTypes.Inflow[],
): Promise<void> {
    if (chosen.length === 0) {
        context.failSubmit("Marque ao menos uma entrada para trazer.");
        return;
    }

    context.beginSubmit();

    try {
        /* O rateio só existe no `get(id)`, e ele é a parte que dá
           trabalho de redigitar — clonar sem ele seria clonar pela
           metade. São poucas chamadas (um mês tem cinco a dez entradas)
           e só das escolhidas. */
        const details = await Promise.all(
            chosen.map((inflow) => InflowsConnection.get(inflow.IdInflow)),
        );

        const { IdInflows } = await InflowsConnection.createBatch({
            Inflows: details.map(cloneBody),
        });

        context.closeCloneMonth();
        context.finishSubmit(
            `${IdInflows.length} entrada${IdInflows.length === 1 ? "" : "s"} trazida${
                IdInflows.length === 1 ? "" : "s"
            } do mês anterior — todas em aberto, esperando o recebimento.`,
        );
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
