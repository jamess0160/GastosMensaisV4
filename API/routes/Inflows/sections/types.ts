export namespace InflowsNamespace {

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
        /** Nasce recebida: grava `Status: 'received'` e o `ReceivedAt` na própria criação, e o
         *  dinheiro entra no saldo na hora. É um booleano e não um `Status` — 'canceled' no
         *  nascimento fica proibido por construção. No lote é sempre `false`
         *  (ver Inflows.schema.ts). */
        Received: boolean
    }

    //  Sem Kind e sem contas: mudar qualquer um dos três reescreveria o que o lançamento
    //  significa, e o saldo das contas envolvidas junto. Ver PUT/update.ts.
    export interface UpdateInflowPayload {
        Description: string
        TotalValue: number
        CompetenceDate: string
        ExpectedDate?: string | null
        Notes?: string | null
    }
}
