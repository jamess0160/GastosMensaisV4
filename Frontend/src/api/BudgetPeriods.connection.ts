import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/BudgetPeriods` — sem GET (o mês sai em `BudgetsConnection`,
 *  que é onde ele significa algo) e sem POST (o mês nasce no POST de
 *  Budgets). As duas rotas mexem em UM mês só. */
class Connection {
    private readonly route = "/BudgetPeriods";

    /** `ReferenceMonth` e `IdBudget` não são aceitos: mover o teto de
     *  lugar é apagar este e cadastrar outro. */
    async update(
        idBudgetPeriod: number,
        body: ApiTypes.BudgetPeriodUpdateBody,
    ): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdBudgetPeriod=${idBudgetPeriod}`,
            body,
        );
        return data;
    }

    /** Delete FÍSICO — o único do projeto. Um período é plano, não
     *  lançamento: nada aponta para ele e nenhum dinheiro passou por ali.
     *  A definição sobrevive. */
    async remove(idBudgetPeriod: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdBudgetPeriod=${idBudgetPeriod}`,
        );
        return data;
    }
}

export const BudgetPeriodsConnection = new Connection();
