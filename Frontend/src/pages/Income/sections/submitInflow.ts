import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext, InflowDraft } from "../controller";

/* ════════════════════════════════════════════════════════════
   Entrada e transferência moram na mesma tabela e se separam por
   `Kind`, e a única assimetria que sobrou é a conta de origem:

   | Kind       | IdFromAccount        |
   |------------|----------------------|
   | inflow     | só aceita null       |
   | transfer   | obrigatório, ≠ To    |

   Uma entrada é descrição, valor, as duas datas, a conta em que cai e a
   observação. O rateio entre pessoas saiu do produto na leva 10: quem
   responde "de quem é esse dinheiro" é o Orçamento, que é a repartição
   da renda do mês — duas respostas para a mesma pergunta divergem na
   primeira vez que alguém preenche uma e esquece a outra.
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

    try {
        if (draft.IdInflow !== null) {
            // `Kind`, contas e `Status` não se editam: os três
            // reescreveriam o que o lançamento significa, e o saldo das
            // contas envolvidas junto.
            await InflowsConnection.update(draft.IdInflow, {
                Description: draft.Description.trim(),
                TotalValue: draft.TotalValue as number,
                CompetenceDate: draft.CompetenceDate,
                ExpectedDate: draft.ExpectedDate,
                Notes: draft.Notes.trim() || null,
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
