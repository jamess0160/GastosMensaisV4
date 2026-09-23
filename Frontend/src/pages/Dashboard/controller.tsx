import { removeBudgetPeriod } from "./sections/removeBudgetPeriod";
import { saveBudget } from "./sections/saveBudget";
import type { ApiTypes } from "@/types/api";

/** Qual dos dois campos de alvo o FORMULÁRIO está editando.
 *
 *  É estado de tela, não da API: a resposta traz `IdCategory` e
 *  `IdPerson` e nada mais, e desde a leva 9 os dois podem vir juntos. O
 *  formulário ainda pede um alvo de cada vez — a tela do orçamento é
 *  reescrita na etapa 12, e é lá que a fatia de pessoa + categoria ganha
 *  como ser montada. */
export type BudgetDraftScope = "category" | "person";

/** O rascunho de uma fatia do orçamento.
 *
 *  `IdBudgetPeriod` nulo é "criar a fatia" (POST /BudgetPeriods);
 *  preenchido é "corrigir o valor dela" (PUT). O alvo não se muda numa
 *  fatia que já existe: mover é apagar esta e cadastrar outra. */
export interface BudgetDraft {
    IdBudgetPeriod: number | null;
    /** O rascunho guarda os dois ids para o usuário poder trocar de alvo
     *  sem perder o que já escolheu; quem decide qual vai no corpo é o
     *  `Scope` acima. */
    Scope: BudgetDraftScope;
    IdCategory: number | null;
    IdPerson: number | null;
    ReferenceMonth: ApiTypes.ReferenceMonth;
    LimitValue: ApiTypes.Money | null;
    AlertPercent: number;
}

export interface DashboardContext {
    budgetDraft: BudgetDraft | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    closeBudgetForm(): void;
}

class Controller {
    readonly saveBudget = saveBudget;
    readonly removeBudgetPeriod = removeBudgetPeriod;
}

export const DashboardController = new Controller();
