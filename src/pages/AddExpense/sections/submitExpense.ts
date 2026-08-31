import { errorMessage } from "@/api/client";
import { ExpensesConnection } from "@/api/Expenses.connection";
import { splitIsClosed, usableLines } from "@/ui/SplitEditor";
import type { AddExpenseContext, ExpenseDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   O corpo do POST/PUT de gasto.

   Três coisas do contrato mandam na forma dele, e errar qualquer uma
   é 406 garantido:

   1. Os DOIS rateios não se cruzam. `Payments` é financeiro (com qual
      forma foi pago — move saldo) e `Persons` é analítico (de quem é
      o custo — não move saldo). Duas formas + duas pessoas são
      2 + 2 linhas, nunca 4, e cada eixo fecha com o `TotalValue` por
      conta própria.
   2. Todo rateio é por VALOR ABSOLUTO e a soma bate em centavos.
   3. Os campos de formato são exclusivos: `InstallmentTotal` é
      obrigatório em `installment` e PROIBIDO nos outros;
      `RecurrenceDay`/`RecurrenceEndDate`/`Occurrences` só existem em
      `fixed`. Não é "campo ignorado" — é recusa.
   ════════════════════════════════════════════════════════════ */

/** O que a tela confere antes de gastar a requisição.
 *
 *  Devolve `null` quando está tudo certo. É a mesma conferência que
 *  habilita o botão de salvar, para que o botão nunca esteja aceso
 *  levando a uma recusa previsível. */
export function validateExpense(draft: ExpenseDraft, isEdit: boolean): string | null {
    if (!draft.Description.trim()) return "Informe a descrição do gasto.";
    if (draft.TotalValue === null || draft.TotalValue <= 0) {
        return "Informe um valor maior que zero.";
    }
    if (draft.IdCategory === null) return "Escolha uma categoria — ela é obrigatória.";
    if (!draft.ExpenseDate) return "Informe a data do gasto.";

    // `Payments` é obrigatório (mín. 1) e fecha com o total.
    const payments = usableLines(draft.payments);
    if (payments.length === 0) return "Escolha ao menos uma forma de pagamento.";
    if (!splitIsClosed(draft.payments, draft.TotalValue)) {
        return "A soma das formas de pagamento precisa fechar com o total.";
    }

    // Parcelado aceita UMA única perna: a API divide essa perna nas N
    // parcelas, e duas formas não teriam como ser divididas juntas.
    if (draft.Kind === "installment" && payments.length > 1) {
        return "Compra parcelada aceita uma forma de pagamento só.";
    }
    if (
        draft.Kind === "installment" &&
        (draft.InstallmentTotal < 2 || draft.InstallmentTotal > 120)
    ) {
        return "O número de parcelas vai de 2 a 120.";
    }
    if (draft.Kind === "fixed" && (draft.Occurrences < 1 || draft.Occurrences > 60)) {
        return "O número de ocorrências vai de 1 a 60.";
    }

    // `Persons` é opcional; quando existe, fecha por conta própria.
    if (usableLines(draft.persons).length > 0 && !splitIsClosed(draft.persons, draft.TotalValue)) {
        return "A soma do rateio entre pessoas precisa fechar com o total.";
    }

    // As parcelas de uma compra parcelada não se editam: a API responde
    // "cancele e lance de novo". A tela nem abre o formulário nesse
    // caso, mas a conferência fica aqui para o caminho que escapar.
    if (isEdit && draft.Kind === "installment") {
        return "Compra parcelada não se edita: cancele e lance de novo.";
    }

    return null;
}

const toPayments = (draft: ExpenseDraft): ApiTypes.ExpensePaymentInput[] =>
    usableLines(draft.payments).map((line) => ({
        IdPaymentMethod: line.id,
        Value: line.value,
        // `Paid: true` é o caso do débito, que já sai pago no ato; no
        // cartão a perna fica em aberto e se quita pela rota da perna.
        Paid: line.paid ?? false,
    }));

const toPersons = (draft: ExpenseDraft): ApiTypes.SplitInput[] =>
    usableLines(draft.persons).map((line) => ({ IdPerson: line.id, Value: line.value }));

/** Criar ou editar um gasto. */
export async function submitExpense(context: AddExpenseContext): Promise<void> {
    const { draft, idExpense } = context;

    const invalid = validateExpense(draft, idExpense !== null);
    if (invalid) {
        context.failSubmit(invalid);
        return;
    }

    context.beginSubmit();

    const common = {
        Description: draft.Description.trim(),
        TotalValue: draft.TotalValue as number,
        IdCategory: draft.IdCategory as number,
        ExpenseDate: draft.ExpenseDate,
        Notes: draft.Notes.trim() || null,
        Payments: toPayments(draft),
        Persons: toPersons(draft),
        // Texto, não id: a API reusa a tag existente ignorando
        // maiúsculas, desarquiva a arquivada ou insere a nova, tudo
        // dentro da transaction do gasto.
        Tags: draft.tags,
    };

    try {
        if (idExpense !== null) {
            // `Kind`, `Status` e a recorrência não se editam — por isso
            // eles não estão neste corpo.
            await ExpensesConnection.update(idExpense, common);
            context.finishSubmit(1);
            return;
        }

        const body: ApiTypes.ExpenseCreateBody = {
            ...common,
            Kind: draft.Kind,
            // Exclusivos do formato. Espalhar condicionalmente é o que
            // impede `InstallmentTotal: undefined` de virar chave no
            // JSON de um gasto à vista.
            ...(draft.Kind === "installment" ? { InstallmentTotal: draft.InstallmentTotal } : {}),
            ...(draft.Kind === "fixed"
                ? {
                      Occurrences: draft.Occurrences,
                      ...(draft.RecurrenceDay !== null
                          ? { RecurrenceDay: draft.RecurrenceDay }
                          : {}),
                      ...(draft.RecurrenceEndDate !== null
                          ? { RecurrenceEndDate: draft.RecurrenceEndDate }
                          : {}),
                  }
                : {}),
        };

        const { Occurrences } = await ExpensesConnection.create(body);
        context.finishSubmit(Occurrences);
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
