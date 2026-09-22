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

    /**
     * Uma fatura de um cartão, vista de fora: o vencimento que a identifica e o que há nela.
     *
     * É o que `getInvoiceDues` devolve — uma linha por vencimento, sem as pernas. A fatura não
     * é cadastro nenhum, então esta é a lista de faturas que o cartão tem: o que existe é o
     * conjunto de `DueDate` gravados nas pernas dele.
     */
    export interface InvoiceDue {
        DueDate: string
        /** Quantas pernas, contando o previsto: é ele que diz se a fatura existe. */
        Legs: number
        /** Só o que está na fatura (`Charged`) — o mesmo recorte do `Total` do extrato. */
        Total: number
    }
}
