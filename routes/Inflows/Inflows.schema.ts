import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, periodQuery } from "root/Utils/joiSchemas"

const status = Joi.string().valid("pending", "received", "canceled")
const kind = Joi.string().valid("inflow", "transfer")

//  Uma linha do rateio. Valor absoluto, nunca porcentagem: porcentagem obrigaria a decidir
//  onde cai o centavo do arredondamento em toda leitura.
const splitItem = Joi.object({
    IdPerson: Joi.number().required(),
    Value: Joi.number().precision(2).positive().required(),
})

const inflowResponse = Joi.object({
    IdInflow: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdUser: Joi.number().allow(null).required(),
    Description: Joi.string().required(),
    TotalValue: Joi.number().required(),
    Status: status.required(),
    Kind: kind.required(),
    IdFromAccount: Joi.number().allow(null).required(),
    IdToAccount: Joi.number().allow(null).required(),
    //  Datas de calendário: chegam do Postgres como "YYYY-MM-DD" e saem como vieram.
    CompetenceDate: isoDate.required(),
    ExpectedDate: isoDate.allow(null).required(),
    //  ReceivedAt é datetime de verdade: é o instante em que o dinheiro caiu.
    ReceivedAt: Joi.date().allow(null).required(),
    Notes: Joi.string().allow(null).required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    public readonly getByWorkspace = [
        //  From/To é o formato de período compartilhado com Expenses (Utils/joiSchemas.ts).
        joiController.validateQuery(Joi.object({
            ...periodQuery,
            Status: status.optional(),
            Kind: kind.optional(),
        })),
        joiController.validateResponse(Joi.array().items(inflowResponse)),
    ]

    public readonly getUnique = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
        joiController.validateResponse(inflowResponse.keys({
            Persons: Joi.array().items(Joi.object({
                IdInflowPerson: Joi.number().required(),
                IdWorkspace: Joi.number().required(),
                IdInflow: Joi.number().required(),
                IdPerson: Joi.number().required(),
                Value: Joi.number().required(),
                CreatedAt: Joi.date().required(),
                UpdatedAt: Joi.date().required(),
            })).required(),
        })),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            //  positive: entrada de valor zero ou negativo é saída, e saída é gasto.
            TotalValue: Joi.number().precision(2).positive().required(),
            Kind: kind.default("inflow"),
            //  O `when` é a primeira barreira das regras do Kind; a segunda é a InflowKind
            //  section, que é quem sabe se as contas são deste workspace.
            IdFromAccount: Joi.number().when("Kind", {
                is: "transfer",
                then: Joi.required(),
                //  Em "inflow" o dinheiro veio de fora: aceita o nulo explícito, recusa um id.
                otherwise: Joi.valid(null).default(null),
            }),
            IdToAccount: Joi.number().required(),
            CompetenceDate: isoDate.required(),
            ExpectedDate: isoDate.allow(null).default(null),
            Notes: Joi.string().trim().allow(null).default(null),
            //  Só em "inflow". O forbidden aqui e a mensagem da section dizem a mesma coisa: a
            //  transferência não muda o dono do dinheiro, então não há o que ratear.
            Persons: Joi.array().items(splitItem).when("Kind", {
                is: "transfer",
                then: Joi.forbidden(),
                otherwise: Joi.optional(),
            }).default([]),
            //  Sem Status: a entrada nasce pendente, e só receive/cancel a movem.
        })),
        joiController.validateResponse(Joi.object({
            IdInflow: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            TotalValue: Joi.number().precision(2).positive().required(),
            CompetenceDate: isoDate.required(),
            ExpectedDate: isoDate.allow(null).optional(),
            Notes: Joi.string().trim().allow(null).optional(),
            //  Omitir mantém o rateio gravado; enviar substitui ele inteiro.
            Persons: Joi.array().items(splitItem).optional(),
            //  Sem Kind, sem contas e sem Status: os três reescreveriam o que o lançamento
            //  significa, e o saldo das contas envolvidas junto. Ver sections/PUT/update.ts.
        })),
    ]

    public readonly receive = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
    ]

    public readonly unreceive = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
    ]
}

export const Inflows_schema = new Schema()
