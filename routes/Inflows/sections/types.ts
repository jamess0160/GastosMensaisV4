export namespace InflowsNamespace {

    /** Uma linha do rateio: quem recebeu e quanto, em valor absoluto — nunca em porcentagem. */
    export interface SplitPayload {
        IdPerson: number
        Value: number
    }

    export interface ListFilters {
        /** Data de calendário "YYYY-MM-DD". Ver periodQuery em Utils/joiSchemas.ts. */
        From?: string
        To?: string
        Status?: "pending" | "received" | "canceled"
        Kind?: "inflow" | "transfer"
    }

    export interface CreateInflowPayload {
        Description: string
        TotalValue: number
        //  'inflow' = veio de fora (IdFromAccount nulo); 'transfer' = entre contas próprias,
        //  as duas obrigatórias e diferentes. Dois CHECK do banco são a rede; o Joi e a
        //  InflowKind recusam antes, com mensagem.
        Kind: "inflow" | "transfer"
        IdFromAccount: number | null
        IdToAccount: number
        /** Data de competência: a que a lista do mês usa. */
        CompetenceDate: string
        ExpectedDate: string | null
        Notes: string | null
        /** Só em Kind='inflow'. A soma tem que fechar com o TotalValue. */
        Persons: SplitPayload[]
    }

    //  Sem Kind e sem contas: mudar qualquer um dos três reescreveria o que o lançamento
    //  significa, e o saldo das contas envolvidas junto. Ver PUT/update.ts.
    export interface UpdateInflowPayload {
        Description: string
        TotalValue: number
        CompetenceDate: string
        ExpectedDate?: string | null
        Notes?: string | null
        /** Omitir mantém o rateio gravado; enviar substitui ele inteiro. */
        Persons?: SplitPayload[]
    }
}
