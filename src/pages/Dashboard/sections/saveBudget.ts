import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import { BudgetsConnection } from "@/api/Budgets.connection";
import type { DashboardContext } from "../controller";

/** Definir ou corrigir o teto de um ALVO no mês.
 *
 *  O alvo é uma CATEGORIA ou uma PESSOA, nunca os dois — mesma tabela,
 *  mesmo POST, mesma lista, e `IdCategory`/`IdPerson` são mutuamente
 *  exclusivos: mandar os dois, ou nenhum, é 406. Os dois somam coisas
 *  diferentes: a categoria soma o gasto inteiro, a pessoa soma o eixo
 *  ANALÍTICO (`ExpensePersons`), rateado pela parcela.
 *
 *  São DUAS rotas, e a diferença não é técnica:
 *
 *  - `POST /Budgets` resolve a DEFINIÇÃO vigente (cria, ou atualiza — só
 *    existe uma por alvo) e materializa o mês. Isso muda o FUTURO.
 *  - `PUT /BudgetPeriods` mexe em UM mês só, e a definição segue como
 *    estava. É a correção de um mês que já foi congelado.
 *
 *  Mês passado guarda o teto que realmente valeu: nunca se lê o limite
 *  de um mês passado da definição. É essa separação que a escolha entre
 *  as duas rotas preserva.
 *
 *  `ReferenceMonth` vai como "YYYY-MM" e volta como "YYYY-MM-01" — a
 *  coluna guarda o dia 1. E `ReferenceMonth`/`IdBudget` não são aceitos
 *  no PUT: mover o teto de lugar é apagar este e cadastrar outro. */
export async function saveBudget(context: DashboardContext): Promise<void> {
    const draft = context.budgetDraft;
    if (!draft) return;

    const target = draft.Scope === "person" ? draft.IdPerson : draft.IdCategory;
    if (target === null) {
        context.failSubmit(draft.Scope === "person" ? "Escolha a pessoa." : "Escolha a categoria.");
        return;
    }
    if (draft.LimitValue === null || draft.LimitValue <= 0) {
        // Teto zero é não ter teto: para isso, apaga-se o mês.
        context.failSubmit("O teto precisa ser maior que zero. Para tirar o teto, remova o mês.");
        return;
    }
    if (draft.AlertPercent < 1 || draft.AlertPercent > 100) {
        context.failSubmit("O alerta vai de 1% a 100%.");
        return;
    }

    context.beginSubmit();

    try {
        if (draft.IdBudgetPeriod === null) {
            await BudgetsConnection.upsert({
                // Exatamente UM dos dois — a união do tipo é o que impede
                // montar aqui um corpo que a API recusaria.
                ...(draft.Scope === "person" ? { IdPerson: target } : { IdCategory: target }),
                ReferenceMonth: draft.ReferenceMonth,
                LimitValue: draft.LimitValue,
                AlertPercent: draft.AlertPercent,
            });
            context.closeBudgetForm();
            context.finishSubmit("Teto definido para este mês.");
        } else {
            await BudgetPeriodsConnection.update(draft.IdBudgetPeriod, {
                LimitValue: draft.LimitValue,
                AlertPercent: draft.AlertPercent,
            });
            context.closeBudgetForm();
            context.finishSubmit("Teto deste mês corrigido — a definição segue como estava.");
        }
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
