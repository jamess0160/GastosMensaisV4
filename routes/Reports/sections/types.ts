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

    /** Uma compra dentro da fatura. Aqui o valor é positivo: é o que a fatura cobra. */
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

    /** Uma fatura: o par (cartão, vencimento), que é tudo que uma fatura é neste modelo. */
    export interface CardStatement {
        IdPaymentMethod: number
        Name: string
        DueDate: string
        Total: number
        Entries: CardEntry[]
    }
}
