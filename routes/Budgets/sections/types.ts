export namespace BudgetsNamespace {

    export interface CreateBudgetPayload {
        /** A categoria que ganha teto. Uma definição por categoria, no workspace inteiro. */
        IdCategory: number
        /** "YYYY-MM". O mês que está sendo orçado — hoje sempre informado pelo usuário. */
        ReferenceMonth: string
        LimitValue: number
        /** A partir de quantos por cento do teto o cliente deve alertar. */
        AlertPercent: number
    }
}
