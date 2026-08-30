import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Budgets`
 *
 *  `Budgets` é a definição vigente (uma linha por categoria, sem mês);
 *  `BudgetPeriods` é o mês congelado. Editar a definição muda o FUTURO;
 *  mês passado guarda o teto que realmente valeu. Nunca leia o limite de
 *  um mês passado da definição. */
class Connection {
    private readonly route = "/Budgets";

    /** `ReferenceMonth` obrigatório, no formato "YYYY-MM" — aqui o mês É a
     *  unidade, ao contrário das listagens de movimento, que usam From/To.
     *  Na resposta ele volta como "YYYY-MM-01".
     *
     *  `Spent` soma PERNAS (600 em 6× custa 100 ao mês), usa
     *  coalesce(DueDate, ExpenseDate) e conta pendente junto com pago —
     *  ao contrário do saldo da conta. O alerta é comparação do cliente:
     *  a resposta traz LimitValue, Spent e AlertPercent. */
    async list(referenceMonth: ApiTypes.ReferenceMonth): Promise<ApiTypes.BudgetPeriod[]> {
        const { data } = await http.get<ApiTypes.BudgetPeriod[]>(this.route, {
            params: { ReferenceMonth: referenceMonth },
        });
        return data;
    }

    /** Numa transaction: resolve a definição vigente (cria ou atualiza —
     *  só existe uma por categoria) e materializa o mês. `Status` não é
     *  aceito: o mês nasce `open`. */
    async upsert(
        body: ApiTypes.BudgetCreateBody,
    ): Promise<{ IdBudget: number; IdBudgetPeriod: number }> {
        const { data } = await http.post<{ IdBudget: number; IdBudgetPeriod: number }>(
            this.route,
            body,
        );
        return data;
    }
}

export const BudgetsConnection = new Connection();
