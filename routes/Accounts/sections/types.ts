export namespace AccountsNamespace {

    export interface CreateAccountPayload {
        Name: string
        //  Não existe 'credit_card' aqui: cartão de crédito é forma de pagamento, não conta.
        //  O 'card' é outra coisa — é o vale-alimentação: saldo fechado, sem fatura nenhuma.
        Type: "checking" | "cash" | "card"
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
        //  Aceito aqui, mas a section recusa a troca depois que a conta tem lançamento: o
        //  Type decide quais formas de pagamento nasceram, e trocá-lo não as refaz.
        Type?: "checking" | "cash" | "card"
        IconPath?: string | null
        Color?: string | null
        InitialBalance?: number
        InitialBalanceDate?: string | null
        Position?: number | null
    }
}
