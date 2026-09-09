export namespace ExpensesNamespace {

    /** Uma perna do eixo financeiro: por qual forma de pagamento sai, e quanto. */
    export interface PaymentPayload {
        IdPaymentMethod: number
        Value: number
        /** Já quitada no ato — o caso do débito e do pix. Cartão nasce em aberto. */
        Paid?: boolean
    }

    /** Uma linha do eixo analítico: de quem é o custo. Valor absoluto, nunca porcentagem. */
    export interface SplitPayload {
        IdPerson: number
        Value: number
    }

    export interface ListFilters {
        From?: string
        To?: string
        Status?: "pending" | "paid" | "canceled"
        Kind?: "single" | "installment" | "fixed"
        IdCategory?: number
        /** Traz os cancelados junto com o resto. Sem ele (ou false), a lista de hoje. */
        IncludeCanceled?: boolean
    }

    export interface CreateExpensePayload {
        Description: string
        TotalValue: number
        /** Obrigatória: é ela que responde "com o que eu gasto". Ver ExpenseCategory.section. */
        IdCategory: number
        /** Data da compra. Data de calendário "YYYY-MM-DD", nunca um Date. */
        ExpenseDate: string
        Kind: "single" | "installment" | "fixed"
        Notes: string | null
        /** Eixo financeiro. A soma tem que fechar com o TotalValue. */
        Payments: PaymentPayload[]
        /** Eixo analítico. Se vier, a soma também tem que fechar com o TotalValue. */
        Persons: SplitPayload[]
        /**
         * O **texto** das tags, não ids: a tag não tem cadastro próprio, ela nasce junto com o
         * gasto a partir do que o usuário digitou. Opcional — a maioria dos gastos não tem
         * nenhuma. Ver Tags/sections/POST/resolveByName.ts.
         */
        Tags: string[]
        /** Só em Kind='installment': em quantas vezes. */
        InstallmentTotal?: number
        /** Só em Kind='fixed': dia do mês da cobrança. */
        RecurrenceDay?: number
        /** Só em Kind='fixed'. Nulo = série sem fim (limitada pela janela do servidor). */
        RecurrenceEndDate?: string | null
    }

    //  Sem Kind, sem Status e sem os campos de recorrência: o formato do gasto não muda depois
    //  de lançado, e o Status é derivado das pernas. Ver PUT/update.ts.
    export interface UpdateExpensePayload {
        Description: string
        TotalValue: number
        IdCategory: number
        ExpenseDate: string
        Notes?: string | null
        /** Omitir mantém as pernas gravadas; enviar substitui todas. */
        Payments?: PaymentPayload[]
        /** Omitir mantém o rateio gravado; enviar substitui ele inteiro. */
        Persons?: SplitPayload[]
        /** Omitir mantém as tags; enviar substitui todas, pelo texto delas. */
        Tags?: string[]
    }

    //  A edição da série mexe em várias ocorrências de uma vez, e só nas futuras.
    export interface UpdateSeriesPayload {
        Description: string
        TotalValue: number
        IdCategory: number
        Notes?: string | null
        Persons?: SplitPayload[]
    }
}
