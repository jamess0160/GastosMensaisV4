import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import type { BudgetContext, BudgetLine } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Salvar o rateio do mês — UMA escrita, o mês inteiro.

   O gesto da tela é um só: o usuário mexe em cinco linhas, apaga uma,
   cria outra, e clica em salvar. `POST /BudgetPeriods/allocate` recebe
   o mês DEPOIS da escrita e resolve a diferença dentro de uma
   transaction — o que sumiu é apagado, o que ficou é atualizado no
   lugar, o que é novo entra. Com `POST`, `PUT` e `DELETE` linha a
   linha esse clique seriam sete requisições, e a quarta falhando
   deixaria o mês num rateio que ninguém escreveu.

   NENHUMA LINHA LEVA `IdBudgetPeriod`: a identidade de uma fatia é o
   ALVO. Uma linha que mudou de alvo não é um caso à parte — ela é uma
   remoção mais uma inserção, e é isso que a rota faz com ela.

   E `AlertPercent` não vai no corpo: omitido, ele mantém o que a linha
   já tinha e nasce 80 na linha nova. Mandá-lo daqui exigiria um
   segundo número em cada linha da tela para uma regra que quase
   ninguém ajusta.
   ════════════════════════════════════════════════════════════ */

/** A linha em branco que o editor cria e o usuário nunca preencheu.
 *
 *  Ela é RASCUNHO, não erro: quem clica em "adicionar linha" e desiste
 *  não pode ser impedido de salvar o resto. O que é erro é a linha meio
 *  preenchida — valor sem alvo, ou alvo sem valor —, porque aí alguém
 *  quis dizer alguma coisa e a fatia gravada não diria. */
const isBlank = (line: BudgetLine): boolean =>
    line.id === null && (line.secondaryId ?? null) === null && line.value === null;

/** O alvo como string, para achar a linha repetida.
 *
 *  `null` não é comparável por igualdade em lugar nenhum — nem no SQL
 *  nem aqui —, e é justamente o alvo ausente que distingue "Mercado" de
 *  "Luana em Mercado". */
const targetKey = (line: BudgetLine): string => `${line.secondaryId ?? ""}|${line.id ?? ""}`;

/** As linhas prontas para virar corpo, ou a frase que impede o envio.
 *
 *  Separada do `saveAllocation` para ser lida e testada sozinha: são
 *  quatro recusas, e três delas a API também faz — a diferença é que
 *  aqui elas chegam antes do clique custar uma requisição, e com a
 *  frase que diz qual linha consertar. */
export function allocationBody(
    month: ApiTypes.ReferenceMonth,
    lines: readonly BudgetLine[],
): { body: ApiTypes.BudgetMonthAllocateBody } | { error: string } {
    const filled = lines.filter((line) => !isBlank(line));

    const seen = new Set<string>();

    for (const line of filled) {
        if (line.id === null && (line.secondaryId ?? null) === null) {
            return { error: "Toda linha precisa de uma pessoa, uma categoria, ou as duas." };
        }

        if (line.value === null || line.value <= 0) {
            // Valor zero é não ter a fatia, e isso se faz tirando a
            // linha — que é o que o botão de remover faz.
            return { error: "Toda linha do rateio precisa de um valor maior que zero." };
        }

        const key = targetKey(line);

        if (seen.has(key)) {
            // A API responde 406 a isto, e a mensagem dela é a mesma:
            // duas linhas para o mesmo alvo não são duas fatias, são uma
            // soma que alguém escreveu em dois lugares.
            return { error: "Há duas linhas para o mesmo alvo. Some os valores numa linha só." };
        }

        seen.add(key);
    }

    return {
        body: {
            ReferenceMonth: month,
            // O `as` é o preço da união "pelo menos um alvo" no tipo: o
            // laço acima já provou que um dos dois existe, e a união não
            // tem como saber disso.
            Lines: filled.map((line) => ({
                ...(line.secondaryId ? { IdCategory: line.secondaryId } : {}),
                ...(line.id ? { IdPerson: line.id } : {}),
                LimitValue: line.value as ApiTypes.Money,
            })) as ApiTypes.BudgetAllocationLine[],
        },
    };
}

export async function saveAllocation(context: BudgetContext): Promise<void> {
    const result = allocationBody(context.month, context.lines);

    if ("error" in result) {
        context.failSubmit(result.error);
        return;
    }

    context.beginSubmit();

    try {
        const { IdBudgetPeriods } = await BudgetPeriodsConnection.allocate(result.body);

        /* **Lista vazia é resposta legítima**, e não um erro: é o usuário
           que apagou todas as linhas e salvou — "este mês não tem
           orçamento" é uma decisão como qualquer outra. */
        context.finishSubmit(
            IdBudgetPeriods.length === 0
                ? "Este mês ficou sem orçamento."
                : `Rateio salvo: ${IdBudgetPeriods.length} fatia${
                      IdBudgetPeriods.length === 1 ? "" : "s"
                  }.`,
        );
    } catch (cause) {
        // Num mês FECHADO a API responde 403, e a frase sobe daqui.
        context.failSubmit(errorMessage(cause));
    }
}
