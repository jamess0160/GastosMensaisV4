import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color, isoDate } from "root/Utils/joiSchemas"
import { paymentMethodResponse } from "root/routes/PaymentMethods/PaymentMethods.schema"

class Schema {

    //  Sem validateParams em nenhuma rota daqui: o IdWorkspace saiu do caminho e vem do
    //  token da sessão, e o único parâmetro que sobrou é o id da própria linha.
    public readonly getByWorkspace = [
        //  Espelha a linha de Accounts. Não há coluna de saldo atual: o saldo é calculado dos
        //  lançamentos, e essa leitura entra na etapa 4, junto com as entradas.
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdAccount: Joi.number().required(),
            IdWorkspace: Joi.number().required(),
            IdUser: Joi.number().allow(null).required(),
            Name: Joi.string().required(),
            Type: Joi.string().valid("checking", "cash").required(),
            IconPath: Joi.string().allow(null).required(),
            Color: Joi.string().allow(null).required(),
            InitialBalance: Joi.number().required(),
            InitialBalanceDate: isoDate.allow(null).required(),
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
            //  Não há "credit_card": cartão é forma de pagamento, filha da conta.
            Type: Joi.string().valid("checking", "cash").default("checking"),
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
            Type: Joi.string().valid("checking", "cash").optional(),
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
