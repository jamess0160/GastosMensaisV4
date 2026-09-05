import { removeBudgetPeriod } from "./sections/removeBudgetPeriod";
import { saveBudget } from "./sections/saveBudget";
import type { ApiTypes } from "@/types/api";

/** O rascunho de um teto de orçamento.
 *
 *  `IdBudgetPeriod` nulo é "definir o teto deste mês" (POST /Budgets, que
 *  resolve a definição e materializa o mês numa transaction);
 *  preenchido é "corrigir só este mês" (PUT /BudgetPeriods). São rotas
 *  diferentes porque são intenções diferentes: a primeira muda o futuro,
 *  a segunda mexe num mês só. */
export interface BudgetDraft {
    IdBudgetPeriod: number | null;
    /** Categoria OU pessoa — os dois são mutuamente exclusivos, e mandar
     *  os dois (ou nenhum) é 406. O rascunho guarda os dois ids para o
     *  usuário poder trocar de alvo sem perder o que já escolheu; quem
     *  decide qual vai no corpo é o `Scope`. */
    Scope: ApiTypes.BudgetScope;
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
