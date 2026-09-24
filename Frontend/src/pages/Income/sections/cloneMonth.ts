import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import { addMonthsToDate } from "@/lib/date";
import type { IncomeContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Clonar o mês anterior.

   O que se repete todo mês é a renda: salário, aluguel recebido, a
   mesada. Redigitar isso é o trabalho mais chato da tela, e era o botão
   desabilitado que o layout desenhava.

   A ESCOLHA É DO USUÁRIO. A tela lista o mês anterior e ele marca o que
   quer trazer; nada é adivinhado. Isso resolve de graça o problema que
   travava a versão "clonar tudo": não há repetição silenciosa a evitar,
   porque cada linha foi escolhida à mão.

   O QUE O CLIENTE FAZ, E O QUE NÃO FAZ. Ele lista, deixa escolher,
   avança as datas e monta os corpos — a partir da própria LINHA DA
   LISTA, que já tem tudo que a cópia leva. Buscar `GET /Inflows/:id` de
   cada escolhida era o preço do rateio entre pessoas, e ele saiu do
   produto na leva 10. Gravar é UMA chamada — `POST /Inflows/batch` —,
   porque atomicidade é do banco: com um POST por entrada, a terceira
   recusada deixaria o mês pela metade e sem como voltar atrás. O lote é
   tudo ou nada, e a `msg` da recusa diz qual item caiu ("Item 2: ..."),
   contando a partir de 1.
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
 *  Recebe a LINHA DA LISTA: ela já tem tudo que a cópia leva, e é por
 *  isso que clonar não busca mais o detalhe de cada escolhida.
 *
 *  As duas datas andam um mês com o dia aparado (`addMonthsToDate`): um
 *  salário do dia 31 vira 28/02, nunca 03/03. `Status` não vai no corpo
 *  — toda cópia nasce pendente, e é o `receive` de cada uma que move
 *  saldo. É isso que torna a operação segura mesmo quando o usuário
 *  clona sem prestar atenção. */
export function cloneBody(inflow: ApiTypes.Inflow): ApiTypes.InflowCreateBody {
    return {
        Description: inflow.Description,
        TotalValue: inflow.TotalValue,
        Kind: "inflow",
        IdFromAccount: null,
        IdToAccount: inflow.IdToAccount,
        CompetenceDate: addMonthsToDate(inflow.CompetenceDate, 1),
        ExpectedDate: inflow.ExpectedDate === null ? null : addMonthsToDate(inflow.ExpectedDate, 1),
        Notes: inflow.Notes,
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
        /* Uma requisição só, e ela é a gravação: as linhas escolhidas já
           estão em mãos. */
        const { IdInflows } = await InflowsConnection.createBatch({
            Inflows: chosen.map(cloneBody),
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
