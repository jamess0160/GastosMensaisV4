import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import { splitIsClosed, usableLines } from "@/ui/SplitEditor";
import type { IncomeContext, InflowDraft } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Entrada e transferência moram na mesma tabela e se separam por
   `Kind`. As regras não são simétricas:

   | Kind       | IdFromAccount        | Rateio    |
   |------------|----------------------|-----------|
   | inflow     | só aceita null       | permitido |
   | transfer   | obrigatório, ≠ To    | PROIBIDO  |

   A transferência é neutra para o patrimônio — mover 1.000 do Nubank
   para o Itaú não é renda. É por isso que ela não tem rateio: não há
   custo de ninguém a dividir, só dinheiro trocando de bolso.
   ════════════════════════════════════════════════════════════ */

export function validateInflow(draft: InflowDraft): string | null {
    if (!draft.Description.trim()) return "Informe a descrição.";
    if (draft.TotalValue === null || draft.TotalValue <= 0) {
        // Valor negativo seria saída, e saída é gasto.
        return "Informe um valor maior que zero.";
    }
    if (draft.IdToAccount === null) return "Escolha a conta de destino.";

    if (draft.Kind === "transfer") {
        if (draft.IdFromAccount === null) return "Escolha a conta de origem.";
        if (draft.IdFromAccount === draft.IdToAccount) {
            return "A conta de origem precisa ser diferente da de destino.";
        }
        if (usableLines(draft.persons).length > 0) {
            return "Transferência não tem rateio — ela é neutra para o patrimônio.";
        }
    }

    if (
        draft.Kind === "inflow" &&
        usableLines(draft.persons).length > 0 &&
        !splitIsClosed(draft.persons, draft.TotalValue)
    ) {
        return "A soma do rateio entre pessoas precisa fechar com o total.";
    }

    return null;
}

/** Criar ou editar uma entrada / transferência. */
export async function submitInflow(context: IncomeContext): Promise<void> {
    const draft = context.draft;
    if (!draft) return;

    const invalid = validateInflow(draft);
    if (invalid) {
        context.failSubmit(invalid);
        return;
    }

    context.beginSubmit();

    const persons: ApiTypes.SplitInput[] = usableLines(draft.persons).map((line) => ({
        IdPerson: line.id,
        Value: line.value,
    }));

    try {
        if (draft.IdInflow !== null) {
            // `Kind`, contas e `Status` não se editam: os três
            // reescreveriam o que o lançamento significa, e o saldo das
            // contas envolvidas junto.
            //
            // O rateio é reconferido pela API contra o NOVO total mesmo
            // quando não é enviado — por isso ele vai sempre daqui:
            // quando só o total muda, é o rateio gravado que deixa de
            // fechar, e mandá-lo explícito é o que dá ao usuário a
            // chance de corrigir na mesma tela.
            await InflowsConnection.update(draft.IdInflow, {
                Description: draft.Description.trim(),
                TotalValue: draft.TotalValue as number,
                CompetenceDate: draft.CompetenceDate,
                ExpectedDate: draft.ExpectedDate,
                Notes: draft.Notes.trim() || null,
                ...(draft.Kind === "inflow" ? { Persons: persons } : {}),
            });
            context.closeForm();
            context.finishSubmit("Entrada atualizada.");
            return;
        }

        await InflowsConnection.create({
            Description: draft.Description.trim(),
            TotalValue: draft.TotalValue as number,
            Kind: draft.Kind,
            // `inflow` só aceita null aqui: o dinheiro veio de fora.
            IdFromAccount: draft.Kind === "transfer" ? draft.IdFromAccount : null,
            IdToAccount: draft.IdToAccount as number,
            CompetenceDate: draft.CompetenceDate,
            ExpectedDate: draft.ExpectedDate,
            Notes: draft.Notes.trim() || null,
            // Rateio é proibido em transferência — nem lista vazia.
            ...(draft.Kind === "inflow" ? { Persons: persons } : {}),
        });

        context.closeForm();
        // `Status` não é aceito: nasce pendente, e é o `receive` que põe
        // o dinheiro no saldo.
        context.finishSubmit(
            draft.Kind === "transfer"
                ? "Transferência lançada — confirme o recebimento para mover o saldo."
                : "Entrada lançada — ela nasce pendente até você confirmar o recebimento.",
        );
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
