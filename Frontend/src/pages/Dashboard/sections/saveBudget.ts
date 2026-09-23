import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import type { DashboardContext } from "../controller";

/** Criar ou corrigir uma FATIA da renda do mês.
 *
 *  O alvo pode ser uma categoria, uma pessoa, ou as duas — desde a leva
 *  9 `IdCategory` e `IdPerson` não são mais exclusivos, e o que é 406 é
 *  mandar NENHUM dos dois. **Este formulário ainda monta uma fatia de um
 *  alvo só**: a tela do orçamento é reescrita na etapa 12, e é lá que a
 *  fatia de pessoa + categoria ganha como ser montada.
 *
 *  São DUAS rotas, e a diferença não é técnica:
 *
 *  - `POST /BudgetPeriods` cria a fatia. Uma escrita só: não há mais
 *    definição perene para resolver antes.
 *  - `PUT /BudgetPeriods` corrige o valor de uma fatia que já existe.
 *
 *  As duas recusam com 403 num mês FECHADO — é a trava que impede
 *  reescrever a história de agosto em novembro.
 *
 *  `ReferenceMonth` vai como "YYYY-MM" e volta como "YYYY-MM-01" — a
 *  coluna guarda o dia 1. E `ReferenceMonth`/alvo não são aceitos no
 *  PUT: mover a fatia de lugar é apagar esta e cadastrar outra. */
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
            await BudgetPeriodsConnection.create({
                // Pelo menos um dos dois — a união do tipo é o que impede
                // montar aqui um corpo vazio, que a API recusaria.
                ...(draft.Scope === "person" ? { IdPerson: target } : { IdCategory: target }),
                ReferenceMonth: draft.ReferenceMonth,
                LimitValue: draft.LimitValue,
                AlertPercent: draft.AlertPercent,
            });
            context.closeBudgetForm();
            context.finishSubmit("Fatia definida para este mês.");
        } else {
            await BudgetPeriodsConnection.update(draft.IdBudgetPeriod, {
                LimitValue: draft.LimitValue,
                AlertPercent: draft.AlertPercent,
            });
            context.closeBudgetForm();
            context.finishSubmit("Fatia deste mês corrigida.");
        }
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
