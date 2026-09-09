export namespace ReportsNamespace {

    /**
     * Uma linha do extrato da conta. **O `Value` é assinado**, e não duas colunas de débito e
     * crédito: com sinal, a verificação do extrato é literalmente a soma da lista — com duas
     * colunas ela vira uma subtração que alguém escreve ao contrário uma hora.
     */
    export interface AccountEntry {
        Date: string
        Kind: "opening" | "inflow" | "transfer" | "expense" | "invoice"
        Description: string
        Value: number
        /** Em 'inflow' e 'transfer' */
        IdInflow?: number
        /** Em 'expense' */
        IdExpense?: number
        IdExpensePayment?: number
        /** Em 'invoice' — a linha agregada da fatura, cujo detalhe é o extrato do cartão */
        IdPaymentMethod?: number
    }

    export interface AccountStatement {
        IdAccount: number
        Name: string
        Active: boolean
        OpeningBalance: number
        ClosingBalance: number
        Entries: AccountEntry[]
    }

    /**
     * Uma compra dentro da fatura. Aqui o valor é positivo: é o que a fatura cobra.
     *
     * `Charged` diz **se ela está na fatura**, e é o que separa os dois grupos do `CardStatement`
     * — ele nasce `true` na perna de cartão, então o `false` aqui é sempre um clique do usuário.
     */
    export interface CardEntry {
        Date: string
        Description: string
        Value: number
        IdExpense: number
        IdExpensePayment: number
        InstallmentNumber: number | null
        InstallmentTotal: number | null
        Paid: boolean
        Charged: boolean
    }

    /**
     * Uma fatura: o par (cartão, vencimento), que é tudo que uma fatura é neste modelo.
     *
     * **Duas listas, e o `Total` é o da primeira.** `Entries` é o que está na fatura; `Expected`
     * é o que foi lançado no cartão e o usuário desmarcou porque o emissor ainda não registrou.
     * A perna prevista continua vindo na resposta porque o `payInvoice` quita o ciclo inteiro —
     * ela sai da conta junto, e uma saída sem linha que a explique é o que o extrato não pode
     * ter.
     */
    export interface CardStatement {
        IdPaymentMethod: number
        Name: string
        DueDate: string
        /** Só o que está na fatura — o previsto não é cobrado ainda */
        Total: number
        Entries: CardEntry[]
        /** Previsto: lançado no cartão e ainda não visto na fatura do emissor */
        Expected: CardEntry[]
    }

    /** Uma linha da aba "Entradas" da planilha, com os nomes já resolvidos. */
    export interface ExportInflowRow {
        IdInflow: number
        Description: string
        Kind: "inflow" | "transfer"
        TotalValue: number
        Status: "pending" | "received" | "canceled"
        CompetenceDate: string
        ExpectedDate: string | null
        FromAccountName: string | null
        ToAccountName: string | null
    }

    /** Uma linha da aba "Gastos": **a perna**, não a compra. */
    export interface ExportPaymentRow {
        IdExpensePayment: number
        IdExpense: number
        Value: number
        CompetenceDate: string
        CashDate: string
        DueDate: string | null
        InstallmentNumber: number | null
        InstallmentTotal: number | null
        Paid: boolean
        Description: string
        ExpenseDate: string
        ExpenseStatus: "pending" | "paid" | "canceled"
        CategoryName: string | null
        PaymentMethodName: string
        AccountName: string
    }
}
