import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color, isoDate, referenceMonth } from "root/Utils/joiSchemas"
import { paymentMethodResponse } from "root/routes/PaymentMethods/PaymentMethods.schema"

//  Os três tipos de conta, e o que cada um significa para as formas de pagamento que nascem
//  com ela (PaymentMethods/sections/POST/createDefaults.ts):
//
//      checking -> conta bancária: pix + débito. A ÚNICA que aceita cartão de crédito
//      cash     -> dinheiro na carteira: uma forma "Dinheiro"
//      card     -> vale-alimentação: uma forma só, Kind='debit', com o nome da conta
//
//  'card' não é "conta de cartão de crédito": é o oposto disso — saldo fechado e sem fatura.
const accountType = Joi.string().valid("checking", "cash", "card")

class Schema {

    //  Sem validateParams em nenhuma rota daqui: o IdWorkspace saiu do caminho e vem do
    //  token da sessão, e o único parâmetro que sobrou é o id da própria linha.
    public readonly getByWorkspace = [
        //  Mês, e não From/To como nas listagens de movimento: o saldo não é um recorte, é uma
        //  posição — "quanto eu tinha no fim de agosto". Opcional porque a tela abre no mês
        //  corrente e só manda o parâmetro quando o usuário navega.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.optional(),
        })),
        //  Espelha a linha de Accounts, mais o Balance, que **não é coluna**: é calculado dos
        //  lançamentos a cada leitura (sections/AccountBalance.section.ts).
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdAccount: Joi.number().required(),
            IdWorkspace: Joi.number().required(),
            IdUser: Joi.number().allow(null).required(),
            Name: Joi.string().required(),
            Type: accountType.required(),
            IconPath: Joi.string().allow(null).required(),
            Color: Joi.string().allow(null).required(),
            InitialBalance: Joi.number().required(),
            InitialBalanceDate: isoDate.allow(null).required(),
            //  Saldo realizado **até o fim do ReferenceMonth**: abertura + entradas recebidas
            //  − transferências que saíram − pernas de gasto pagas, tudo com data até o corte.
            //  O pendente é previsão e não entra.
            Balance: Joi.number().required(),
            Position: Joi.number().allow(null).required(),
            Active: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
            //  Vêm embutidas pelo joinTables: toda conta tem pelo menos pix e débito. A forma
            //  da linha vem do schema da própria feature, para não haver duas descrições dela.
            PaymentMethods: Joi.array().items(paymentMethodResponse).required(),
        }))),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
            //  Não há "credit_card": cartão de crédito é forma de pagamento, filha da conta.
            //  O 'card' é o vale-alimentação, que é conta de verdade — só não tem fatura.
            Type: accountType.default("checking"),
            IconPath: Joi.string().trim().max(255).allow(null).default(null),
            Color: color.allow(null).default(null),
            //  Negativo é válido (conta no cheque especial). precision(2) porque a coluna é
            //  decimal(15,2) — sem isso o centavo que sobra seria arredondado pelo banco.
            InitialBalance: Joi.number().precision(2).default(0),
            InitialBalanceDate: isoDate.allow(null).default(null),
            Position: Joi.number().integer().allow(null).default(null),
        })),
        //  Só o id: pix e débito nascem junto e saem no GET, que é onde o cliente já ia buscar.
        joiController.validateResponse(Joi.object({
            IdAccount: Joi.number().required(),
        })),
    ]

    //  Edição parcial: só o Name é obrigatório. Sem defaults de propósito — um default(null)
    //  aqui apagaria o ícone da conta em todo PUT que só quisesse renomear.
    public readonly update = [
        joiController.validateParams(Joi.object({
            IdAccount: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
            //  Aceito, mas a section recusa a troca depois do primeiro lançamento — ver
            //  PUT/update.ts. Trocar o Type não cria nem apaga forma de pagamento nenhuma.
            Type: accountType.optional(),
            IconPath: Joi.string().trim().max(255).allow(null).optional(),
            Color: color.allow(null).optional(),
            //  Aceitos aqui, mas a section recusa a troca depois que a conta tem lançamento:
            //  mexer no saldo de abertura reescreve o saldo histórico. Ver PUT/update.ts.
            InitialBalance: Joi.number().precision(2).optional(),
            InitialBalanceDate: isoDate.allow(null).optional(),
            Position: Joi.number().integer().allow(null).optional(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdAccount: Joi.number().required(),
        })),
    ]
}

export const Accounts_schema = new Schema()
