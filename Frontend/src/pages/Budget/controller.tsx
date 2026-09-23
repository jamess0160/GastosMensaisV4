import { cloneBudgetMonth } from "./sections/cloneBudgetMonth";
import { saveAllocation } from "./sections/saveAllocation";
import type { SplitLine } from "@/ui/SplitEditor";
import type { ApiTypes } from "@/types/api";

/** Uma linha do rateio, como a TELA a segura.
 *
 *  É uma `SplitLine` e não um tipo próprio de propósito: o editor é o
 *  mesmo dos dois eixos do gasto (`src/ui/SplitEditor.tsx`), e o que muda
 *  aqui é o alvo ser um PAR — `id` é a pessoa e `secondaryId` é a
 *  categoria, com pelo menos um dos dois preenchido.
 *
 *  **A pessoa é o `id` e a categoria é o segundo**, e não o contrário,
 *  porque é a pessoa que qualifica a fatia: "Luana em mercado" é a
 *  leitura, não "mercado da Luana" — a mesma ordem do `budgetTargetName`.
 *
 *  **Não há `AlertPercent` aqui, e a ausência é decisão**: a rota de
 *  rateio aceita o campo como opcional e, omitido, mantém o que a linha
 *  já tinha (80 numa linha nova). Trazê-lo para cá poria um segundo
 *  número em cada linha da tela para uma regra que quase ninguém
 *  ajusta — e o ajuste dela continua sendo uma edição de fatia. */
export type BudgetLine = SplitLine;

export interface BudgetContext {
    /** O mês que está na tela — o do chassi. */
    month: ApiTypes.ReferenceMonth;
    /** O rateio como está na tela, linhas em branco inclusive: quem
     *  descarta a linha vazia é a section, não o componente. */
    lines: BudgetLine[];
    beginSubmit(): void;
    failSubmit(message: string): void;
    finishSubmit(message: string): void;
}

class Controller {
    readonly saveAllocation = saveAllocation;
    readonly cloneBudgetMonth = cloneBudgetMonth;
}

export const BudgetController = new Controller();
