export namespace AccountsNamespace {

    export interface CreateAccountPayload {
        Name: string
        //  Não existe 'credit_card' aqui: cartão é forma de pagamento, não conta.
        Type: "checking" | "cash"
        IconPath: string | null
        Color: string | null
        /** Saldo de abertura. Dado de origem: nenhum lançamento do sistema o deriva. */
        InitialBalance: number
        /** Data de calendário "YYYY-MM-DD", nunca um Date — ver os pgTypeParsers. */
        InitialBalanceDate: string | null
        Position: number | null
    }

    //  Tudo opcional menos o Name: o PUT aceita edição parcial, então não enviar um campo é
    //  deixá-lo como está — e não apagá-lo por omissão.
    export interface UpdateAccountPayload {
        Name: string
        Type?: "checking" | "cash"
        IconPath?: string | null
        Color?: string | null
        InitialBalance?: number
        InitialBalanceDate?: string | null
        Position?: number | null
    }
}
