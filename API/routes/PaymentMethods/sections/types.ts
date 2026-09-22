export namespace PaymentMethodsNamespace {

    /** Os campos que só existem em Kind='credit_card'. Ver PaymentMethodKind.section.ts. */
    export interface CreditCardFields {
        DueDay?: number | null
        ClosingDay?: number | null
        CompetenceMode?: "invoice" | "purchase" | null
    }

    export interface CreatePaymentMethodPayload extends CreditCardFields {
        IdAccount: number
        Name: string
        //  Só cartão: pix e débito nascem junto com a conta e não se cadastram à mão.
        Kind: "credit_card"
        IconPath: string | null
        Color: string | null
        Position: number | null
    }

    //  Sem Kind: um pix não vira cartão de crédito. Ver PUT/update.ts.
    export interface UpdatePaymentMethodPayload extends CreditCardFields {
        Name: string
        IconPath?: string | null
        Color?: string | null
        Position?: number | null
    }

    /**
     * Uma compra dentro da fatura. O valor é positivo: é o que a fatura cobra.
     *
     * **Mora aqui, e o extrato importa daqui**, porque a fatura é do cartão — `routes/Reports/`
     * não é dona de tabela nenhuma, e a linha da fatura é a mesma nas duas rotas. Duas cópias
     * divergiriam na primeira coluna nova, e aí a tela da fatura e a do extrato mostrariam
     * coisas diferentes sobre a mesma compra.
     *
     * `Charged` diz **se ela está na fatura** — nasce `true` na perna de cartão, então o `false`
     * aqui é sempre um clique do usuário.
     */
    export interface InvoiceEntry {
        /** A data da **compra**, não a do vencimento: é por ela que o usuário reconhece a linha */
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
     * **O estado da fatura, e ele é derivado — não há coluna nem tabela onde guardá-lo.**
     *
     *     open    ->  ainda dá para comprar nela: hoje <= ClosingDate
     *     closed  ->  fechou e o emissor já cobrou o que tinha; falta pagar
     *     paid    ->  todas as pernas do ciclo estão quitadas
     *
     * `paid` vem antes dos outros dois porque é o único que fala de dinheiro: uma fatura
     * adiantada — quitada antes de fechar — continua paga, e chamá-la de "aberta" porque o
     * calendário ainda não chegou no fechamento seria oferecer quitá-la de novo.
     */
    export type InvoiceStatus = "open" | "closed" | "paid"
}
