import { errorMessage } from "@/api/client";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { splitIsClosed, usableLines } from "@/ui/SplitEditor";
import type { ExpensesContext } from "../controller";

/** "Esta e as seguintes" — editar uma ocorrência de gasto fixo e todas
 *  as posteriores.
 *
 *  Age como num calendário: o corte é a DATA da ocorrência chamada, não
 *  o relógio. Ocorrência passada guarda o valor que realmente valeu, e é
 *  isso que faz o histórico continuar verdadeiro depois de um reajuste.
 *
 *  A rota NÃO aceita `ExpenseDate` nem `Payments`, e não é esquecimento:
 *  mexer na data moveria cada ocorrência de mês, e a forma de pagamento
 *  se troca ocorrência a ocorrência. É por isso que o corpo aqui é menor
 *  que o do PUT comum.
 *
 *  `Persons` é opcional — omitir mantém, enviar substitui a lista
 *  inteira. */
export async function updateSeries(context: ExpensesContext, idExpense: number): Promise<void> {
    const draft = context.seriesDraft;

    if (!draft.Description.trim()) {
        context.failSubmit("Informe a descrição.");
        return;
    }
    if (draft.TotalValue === null || draft.TotalValue <= 0) {
        context.failSubmit("Informe um valor maior que zero.");
        return;
    }
    if (draft.IdCategory === null) {
        context.failSubmit("Escolha uma categoria.");
        return;
    }

    const persons = usableLines(draft.persons);
    if (persons.length > 0 && !splitIsClosed(draft.persons, draft.TotalValue)) {
        context.failSubmit("A soma do rateio entre pessoas precisa fechar com o total.");
        return;
    }

    context.beginSubmit();

    try {
        const { Occurrences } = await ExpensesConnection.updateSeries(idExpense, {
            Description: draft.Description.trim(),
            TotalValue: draft.TotalValue,
            IdCategory: draft.IdCategory,
            Notes: draft.Notes.trim() || null,
            Persons: persons.map((line) => ({ IdPerson: line.id, Value: line.value })),
        });

        context.closeSeriesForm();
        context.closeDetail();
        context.finishSubmit(
            `Série atualizada — ${Occurrences} ocorrência${Occurrences === 1 ? "" : "s"} a partir desta.`,
        );
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
