import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, periodQuery } from "root/Utils/joiSchemas"

const status = Joi.string().valid("pending", "received", "canceled")
const kind = Joi.string().valid("inflow", "transfer")

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

//  O corpo de uma entrada, num const só, porque ele é usado em dois lugares: o POST avulso e
//  cada item do POST /Inflows/batch. Um shape paralelo para o lote faria o que é 406 sozinho
//  passar acompanhado.
//
//  A ÚNICA divergência entre os dois é o Received, e ela é declarada nos dois lados logo
//  abaixo: no avulso ele é livre, no lote só aceita false. O campo está fora deste const
//  justamente para a diferença ficar escrita, em vez de nascer de uma chave esquecida.
const inflowBody = Joi.object({
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
    //  Sem Status, e quem o substitui é o booleano abaixo: aceitar Status deixaria um cliente
    //  criar entrada CANCELADA, que não é lançamento nenhum. Depois do nascimento, só
    //  receive/unreceive/cancel movem o estado.
})

//  Nasce recebida? O caso comum é lançar a renda **depois** de ela cair na conta, e exigir o
//  POST .../receive em seguida cobrava dois gestos por um fato só.
//
//  É um booleano, nunca um Status — a mesma forma que a perna de gasto já usa no Paid. O
//  booleano proíbe 'canceled' no nascimento **por construção**, que é a regra que a ausência do
//  Status queria: o que mudou é só o tamanho da porta.
const received = Joi.boolean().default(false)

//  Teto do lote. Um mês de renda tem de cinco a dez linhas; 100 é folga larga e ainda impede
//  que um corpo montado errado abra uma transaction gigante.
const batchLimit = 100

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

    //  A resposta é a MESMA da lista: sem o rateio, a entrada por id não tem nada que a
    //  linha da lista não tenha. O GET por id continua existindo porque reler antes de
    //  editar é o que evita salvar em cima de uma versão velha do cache — e porque a
    //  cancelada sai por aqui, ao contrário da lista.
    public readonly getUnique = [
        joiController.validateParams(Joi.object({
            IdInflow: Joi.number().required(),
        })),
        joiController.validateResponse(inflowResponse),
    ]

    public readonly create = [
        joiController.validateBody(inflowBody.keys({ Received: received })),
        joiController.validateResponse(Joi.object({
            IdInflow: Joi.number().required(),
        })),
    ]

    //  Cada item é o MESMO corpo do POST avulso, validado pelo MESMO schema.
    public readonly createBatch = [
        joiController.validateBody(Joi.object({
            //  min(1): lote vazio não é "nada a fazer", é chamada montada errada — e responder
            //  200 com lista vazia esconderia isso do cliente.
            Inflows: Joi.array().items(inflowBody.keys({
                //  Fixo em false: clonar o mês é repetir renda que ainda **vai** chegar, e
                //  marcar em lote é mover saldo sem olhar linha por linha. Declarado em vez de
                //  omitido para o lote recusar o true com a mesma cara dos outros 406, em vez
                //  de um "chave desconhecida" que não diz o porquê.
                Received: received.valid(false),
            })).min(1).max(batchLimit).required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
            //  Os ids voltam para o cliente invalidar o cache do mês certo.
            IdInflows: Joi.array().items(Joi.number()).required(),
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
