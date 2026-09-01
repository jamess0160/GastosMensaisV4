import { errorMessage } from "@/api/client";
import { ExpensesConnection } from "@/api/Expenses.connection";
import type { AddExpenseContext, ExpenseDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

/** Traduz o gasto que veio da API para o rascunho do formulário.
 *
 *  Só o `get(id)` traz `Payments`, `Persons` e `Tags` — a lista do mês
 *  não os traz, então editar sempre exige esta segunda requisição.
 *
 *  `Tags` volta como a tag INTEIRA (a linha do cadastro), mas o que o
 *  PUT recebe é texto. Por isso o rascunho guarda `Name`, e não `IdTag`. */
export function toDraft(expense: ApiTypes.ExpenseDetail): ExpenseDraft {
    return {
        Description: expense.Description,
        TotalValue: expense.TotalValue,
        IdCategory: expense.IdCategory,
        ExpenseDate: expense.ExpenseDate,
        Kind: expense.Kind,
        Notes: expense.Notes ?? "",
        payments: expense.Payments.map((payment) => ({
            id: payment.IdPaymentMethod,
            value: payment.Value,
            paid: payment.Paid,
        })),
        persons: expense.Persons.map((person) => ({
            id: person.IdPerson,
            value: person.Value,
        })),
        tags: expense.Tags.map((tag) => tag.Name),
        // A recorrência não se edita; os valores vêm só para a tela
        // conseguir mostrar o que foi lançado.
        InstallmentTotal: expense.Payments[0]?.InstallmentTotal ?? 2,
        RecurrenceDay: expense.RecurrenceDay,
        RecurrenceEndDate: expense.RecurrenceEndDate,
    };
}

/** Carrega um gasto para edição. */
export async function loadExpenseForEdit(context: AddExpenseContext): Promise<void> {
    if (context.idExpense === null) return;

    context.beginSubmit();

    try {
        const expense = await ExpensesConnection.get(context.idExpense);
        context.finishLoad(toDraft(expense));
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
