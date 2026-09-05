import { Database } from "root/Utils/database"

export namespace BudgetsNamespace {

    /**
     * Uma linha do orcamento do mes como a rota devolve: o periodo congelado, o alvo inteiro
     * (para a tela ter nome e cor) e o comprometido.
     *
     * Escrita como tipo porque os dois ramos do GET produzem formas diferentes - categoria e
     * pessoa -, e sem a uniao declarada o TypeScript fixaria o tipo no primeiro ramo.
     */
    export interface MonthRow extends Database.BudgetPeriods {
        Scope: "category" | "person"
        IdCategory: number | null
        Category: Database.Categories | null
        IdPerson: number | null
        Person: Database.Persons | null
        /** Nao e coluna: calculado a cada leitura. Ver BudgetSpent.section.ts. */
        Spent: number
    }

    /** O alvo resolvido do teto: exatamente um dos dois preenchido. Ver BudgetTarget.section.ts. */
    export interface BudgetTargetPayload {
        IdCategory: number | null
        IdPerson: number | null
    }

    export interface CreateBudgetPayload {
        /**
         * A categoria que ganha teto. Uma definição por categoria, no workspace inteiro.
         *
         * Exclusiva com IdPerson: o `xor` do schema garante que exatamente um dos dois venha,
         * e o BudgetTarget confere de novo antes de escrever.
         */
        IdCategory?: number
        /** A pessoa que ganha teto — o eixo **analítico**, nunca o financeiro. */
        IdPerson?: number
        /** "YYYY-MM". O mês que está sendo orçado — hoje sempre informado pelo usuário. */
        ReferenceMonth: string
        LimitValue: number
        /** A partir de quantos por cento do teto o cliente deve alertar. */
        AlertPercent: number
    }
}
