export namespace ExpensePaymentsNamespace {

    //  O mesmo recorte das outras listagens de movimento (`periodQuery` em Utils/joiSchemas.ts),
    //  com uma diferença que é o motivo desta rota existir: **a data comparada não é a do gasto,
    //  é a da perna** — `coalesce(DueDate, ExpenseDate)`. É por isso que a 6ª parcela de uma
    //  compra de março aparece aqui em agosto, e não aparece em GET /Expenses.
    export interface ListFilters {
        From?: string
        To?: string
        /** Traz as pernas de gasto cancelado junto. Sem ele (ou false), elas ficam de fora. */
        IncludeCanceled?: boolean
    }
}
