import { cancelExpense } from "./sections/cancelExpense";
import { cancelSeries } from "./sections/cancelSeries";
import { toggleLegPayment } from "./sections/toggleLegPayment";
import { updateSeries } from "./sections/updateSeries";
import type { SplitLine } from "@/ui/SplitEditor";
import type { ApiTypes } from "@/types/api";

/** O rascunho de "esta e as seguintes".
 *
 *  Sem `ExpenseDate` e sem `Payments` de propósito: mexer na data moveria
 *  a ocorrência de mês, e a forma de pagamento se troca ocorrência a
 *  ocorrência. A API não aceita nenhum dos dois nesta rota. */
export interface SeriesDraft {
    Description: string;
    TotalValue: ApiTypes.Money | null;
    IdCategory: number | null;
    Notes: string;
    persons: SplitLine[];
}

export interface ExpensesContext {
    seriesDraft: SeriesDraft;
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
    closeDetail(): void;
    closeSeriesForm(): void;
}

class Controller {
    readonly toggleLegPayment = toggleLegPayment;
    readonly cancelExpense = cancelExpense;
    readonly cancelSeries = cancelSeries;
    readonly updateSeries = updateSeries;
}

export const ExpensesController = new Controller();
