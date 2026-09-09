import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Budgets`
 *
 *  `Budgets` é a definição vigente (uma linha por ALVO, sem mês);
 *  `BudgetPeriods` é o mês congelado. Editar a definição muda o FUTURO;
 *  mês passado guarda o teto que realmente valeu. Nunca leia o limite de
 *  um mês passado da definição.
 *
 *  O ALVO é uma categoria OU uma pessoa — mesma tabela, mesmo POST,
 *  mesma lista. O `Scope` da resposta diz qual é. */
class Connection {
    private readonly route = "/Budgets";

    /** `ReferenceMonth` obrigatório, no formato "YYYY-MM" — aqui o mês É a
     *  unidade, ao contrário das listagens de movimento, que usam From/To.
     *  Na resposta ele volta como "YYYY-MM-01".
     *
     *  `Spent` soma PERNAS (600 em 6× custa 100 ao mês), usa a
     *  `CompetenceDate` e conta pendente junto com pago — ao contrário
     *  do saldo da conta. Em `Scope: "person"` ele ainda é rateado pela
     *  parcela, e pode vir NEGATIVO quando os estornos do mês superam as
     *  compras. O alerta é comparação do cliente: a resposta traz
     *  LimitValue, Spent e AlertPercent.
     *
     *  Um orçamento cujo alvo foi ARQUIVADO some da lista do mês — ele
     *  não tem mais o que mostrar. A linha continua no banco: arquivar
     *  não é apagar, e o mês é histórico. */
    async list(referenceMonth: ApiTypes.ReferenceMonth): Promise<ApiTypes.BudgetPeriod[]> {
        const { data } = await http.get<ApiTypes.BudgetPeriod[]>(this.route, {
            params: { ReferenceMonth: referenceMonth },
        });
        return data;
    }

    /** Numa transaction: resolve a definição vigente (cria ou atualiza —
     *  só existe uma por ALVO) e materializa o mês. `Status` não é
     *  aceito: o mês nasce `open`.
     *
     *  `IdCategory` e `IdPerson` são mutuamente exclusivos: mandar os
     *  dois, ou nenhum, é 406. Orçar o mesmo alvo duas vezes no mesmo mês
     *  também é 406 — o conserto é editar o mês que já existe. */
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
