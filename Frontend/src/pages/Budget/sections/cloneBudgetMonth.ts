import { errorMessage } from "@/api/client";
import { BudgetPeriodsConnection } from "@/api/BudgetPeriods.connection";
import { addMonths, formatMonthLabel } from "@/lib/date";
import type { BudgetContext } from "../controller";
import type { ApiTypes } from "@/types/api";

/* ════════════════════════════════════════════════════════════
   Clonar o orçamento do mês anterior.

   Desde a leva 9 nada se materializa sozinho — a rotina do dia 1º
   morreu junto com o teto perene —, e é isso que faz outubro ser
   montável em setembro. O preço é que o mês novo nasce VAZIO, e
   remontar à mão as mesmas oito linhas todo mês é o trabalho repetido
   que faz a funcionalidade parar de ser usada no terceiro mês.

   O ESTADO VAZIO É QUE OFERECE AS DUAS SAÍDAS — "clonar o mês
   anterior" e "montar do zero" —, porque é ali que o usuário está
   quando a pergunta aparece. É o mesmo gesto que a Renda já tem, e a
   simetria é proposital: as duas telas respondem "o mês que vem se
   parece com este".

   A section nasceu no Início, ao lado do bloco de orçamento que era
   tudo que a funcionalidade tinha de tela. Ela mudou de casa junto com
   o gesto: quem monta um mês agora está no Orçamento, e o Início só
   mostra o resultado.

   O QUE O CLIENTE NÃO FAZ. Ao contrário da Renda, ele não lista, não
   deixa escolher e não monta corpo nenhum: manda `{ From, To }` e
   pronto. Uma fatia não tem data a avançar nem rateio a rebuscar, e as
   três regras que separam o que vem do que não vem — alvo já existente
   no destino, alvo arquivado, mês fechado — são conhecimento do
   servidor. Perguntá-las aqui antes de montar um lote seria perguntar
   e depois gravar sobre uma resposta que pode ter mudado no meio.
   ════════════════════════════════════════════════════════════ */

/** O mês que serve de modelo: o anterior ao que está na tela.
 *
 *  É uma função e não `month - 1` escrito na marcação porque o rótulo
 *  do botão ("Clonar setembro") e o corpo da chamada têm que sair do
 *  MESMO cálculo — dois lugares que viram a virada do ano de formas
 *  diferentes é como o botão passa a dizer um mês e trazer outro. */
export const previousMonth = (month: ApiTypes.ReferenceMonth): ApiTypes.ReferenceMonth =>
    addMonths(month, -1);

export async function cloneBudgetMonth(context: BudgetContext): Promise<void> {
    const month = context.month;
    const from = previousMonth(month);

    context.beginSubmit();

    try {
        const { IdBudgetPeriods } = await BudgetPeriodsConnection.clone({ From: from, To: month });

        /* ZERO linha é resposta legítima, e não um erro: é o segundo
           clique num mês já clonado, ou um mês anterior cujos alvos
           foram todos arquivados. Dizer "0 fatias trazidas" seria
           deixar o usuário procurando o que deu errado. */
        if (IdBudgetPeriods.length === 0) {
            context.finishSubmit(
                `Nada a trazer de ${formatMonthLabel(from)} — as fatias dele já estão neste mês.`,
            );
            return;
        }

        context.finishSubmit(
            `${IdBudgetPeriods.length} fatia${IdBudgetPeriods.length === 1 ? "" : "s"} trazida${
                IdBudgetPeriods.length === 1 ? "" : "s"
            } de ${formatMonthLabel(from)}.`,
        );
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
