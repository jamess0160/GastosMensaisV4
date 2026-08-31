import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import type { DashboardContext } from "../controller";

/** Remover o teto de um mês.
 *
 *  É o ÚNICO delete físico do projeto, e é físico com razão: um período
 *  é plano, não lançamento. Nada aponta para ele e nenhum dinheiro passou
 *  por ali, então não há histórico a preservar.
 *
 *  A DEFINIÇÃO sobrevive: o teto volta a valer no próximo mês em que for
 *  materializado. Remover o mês é "neste mês eu não quero teto", não
 *  "apague este orçamento". */
export async function removeBudgetPeriod(
    context: DashboardContext,
    idBudgetPeriod: number,
): Promise<void> {
    context.beginSubmit();

    try {
        await BudgetPeriodsConnection.remove(idBudgetPeriod);
        context.closeBudgetForm();
        context.finishSubmit("Teto removido deste mês — a definição continua valendo.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
