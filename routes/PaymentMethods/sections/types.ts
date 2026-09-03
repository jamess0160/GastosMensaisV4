export namespace PaymentMethodsNamespace {

    /** Os campos que só existem em Kind='credit_card'. Ver PaymentMethodKind.section.ts. */
    export interface CreditCardFields {
        DueDay?: number | null
        ClosingOffsetDays?: number | null
        Brand?: string | null
        LastDigits?: string | null
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
}
