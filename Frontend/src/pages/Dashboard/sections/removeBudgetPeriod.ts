import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import type { DashboardContext } from "../controller";

/** Remover uma fatia do mês.
 *
 *  É o ÚNICO delete físico do projeto, e é físico com razão: uma fatia
 *  é plano, não lançamento. Nada aponta para ela e nenhum dinheiro passou
 *  por ali, então não há histórico a preservar.
 *
 *  E NADA sobrevive a ela: desde a leva 9 não existe definição perene por
 *  trás. Remover é "neste mês este alvo não tem fatia" — nos outros meses
 *  as linhas continuam de pé, porque cada mês é montado por si.
 *
 *  Num mês FECHADO a API responde 403, e a mensagem sobe daqui. */
export async function removeBudgetPeriod(
    context: DashboardContext,
    idBudgetPeriod: number,
): Promise<void> {
    context.beginSubmit();

    try {
        await BudgetPeriodsConnection.remove(idBudgetPeriod);
        context.closeBudgetForm();
        context.finishSubmit("Orçamento removido deste mês.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
