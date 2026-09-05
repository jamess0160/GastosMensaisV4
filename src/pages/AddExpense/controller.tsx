import { loadExpenseForEdit } from "./sections/loadExpenseForEdit";
import { submitExpense } from "./sections/submitExpense";
import type { SplitLine } from "@/ui/SplitEditor";
import type { ApiTypes } from "@/types/api";

/** O rascunho do formulário.
 *
 *  Os campos de recorrência e de parcelamento ficam SEMPRE aqui, mesmo
 *  quando o formato não os usa: o usuário troca de formato no meio do
 *  preenchimento e não deve perder o que já digitou. Quem decide o que
 *  vai para a API é `submitExpense`, e é lá que o contrato manda —
 *  `InstallmentTotal` fora de `installment` é 406, não é campo ignorado. */
export interface ExpenseDraft {
    Description: string;
    TotalValue: ApiTypes.Money | null;
    IdCategory: number | null;
    ExpenseDate: ApiTypes.CalendarDate;
    Kind: ApiTypes.ExpenseKind;
    Notes: string;
    /** Eixo financeiro: com qual forma foi pago. MOVE saldo. */
    payments: SplitLine[];
    /** Eixo analítico: de quem é o custo. NÃO move saldo. */
    persons: SplitLine[];
    /** Texto, nunca id — é o único lugar do sistema em que uma tag nasce. */
    tags: string[];
    /** Só em `installment`: 2 a 120. */
    InstallmentTotal: number;
    /** Só em `fixed`. `Occurrences` saiu do formulário: a API deixou de
     *  aceitar o campo, e quem decide até quando a série vai é
     *  `RecurrenceEndDate`. */
    RecurrenceDay: number | null;
    RecurrenceEndDate: ApiTypes.CalendarDate | null;
}

export interface AddExpenseContext {
    draft: ExpenseDraft;
    /** Preenchido = edição de um gasto existente. */
    idExpense: number | null;
    /** Os `IdPaymentMethod` que são cartão de crédito.
     *
     *  A conferência do ESTORNO precisa deles: valor negativo só é aceito
     *  em `credit_card`, e a perna não carrega o `Kind` da forma. Vem por
     *  contexto, e não do cache, para a section continuar sendo função
     *  pura de entrada — é o que a mantém testável sem servidor. */
    creditCardMethods: ReadonlySet<number>;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Gravou. `occurrences` é quantas linhas nasceram — 1, ou a série
     *  inteira em `fixed`, quando a resposta informa. */
    finishSubmit(occurrences: number): void;
    /** O gasto veio do servidor e o formulário já pode ser usado. É
     *  separado de `finishSubmit` porque este NÃO sai da tela. */
    finishLoad(draft: ExpenseDraft): void;
}

class Controller {
    readonly submitExpense = submitExpense;
    readonly loadExpenseForEdit = loadExpenseForEdit;
}

export const AddExpenseController = new Controller();
