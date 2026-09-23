import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color } from "root/Utils/joiSchemas"

//  A linha de Categories. Lista plana: a hierarquia existiu e foi derrubada, então não há
//  recursão nenhuma para descrever aqui.
//
//  IdWorkspace não aceita mais nulo: a categoria sem dono acabou na migration 20260922140000,
//  e toda linha que sai daqui é do espaço da sessão. Ele continua na resposta porque a coluna
//  é NOT NULL no banco, e um `allow(null)` aqui descreveria um estado que não existe mais.
export const categoryResponse = Joi.object({
    IdCategory: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    Description: Joi.string().required(),
    IconKey: Joi.string().allow(null).required(),
    Color: Joi.string().allow(null).required(),
    Position: Joi.number().allow(null).required(),
    Active: Joi.boolean().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    //  Sem validateParams em nenhuma rota daqui: o IdWorkspace saiu do caminho e vem do token
    //  da sessão, e o único parâmetro que sobrou é o id da própria linha.
    public readonly getByWorkspace = [
        //  Ausente ou false: a lista de sempre, sem arquivada — é o que o seletor de gasto, o
        //  filtro e o relatório pedem, e é por isso que o padrão é esconder. True: a lista
        //  completa, e quem separa os dois grupos é o cliente, numa requisição só. Mesmo nome
        //  e mesmo significado do IncludeCanceled de GET /Expenses.
        joiController.validateQuery(Joi.object({
            IncludeArchived: Joi.boolean().default(false),
        })),
        joiController.validateResponse(Joi.array().items(categoryResponse)),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            //  Chave do catálogo de ícones do cliente, não um caminho de arquivo — por isso
            //  IconKey aqui e IconPath em Accounts: são colunas diferentes, com sentidos
            //  diferentes.
            IconKey: Joi.string().trim().max(100).allow(null).default(null),
            Color: color.allow(null).default(null),
            Position: Joi.number().integer().allow(null).default(null),
        })),
        joiController.validateResponse(Joi.object({
            IdCategory: Joi.number().required(),
        })),
    ]

    //  Edição parcial: só a Description é obrigatória. Sem defaults de propósito — um
    //  default(null) aqui apagaria o ícone em todo PUT que só quisesse renomear, e um
    //  default(true) no Active desarquivaria a categoria a cada renomeação.
    public readonly update = [
        joiController.validateParams(Joi.object({
            IdCategory: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            IconKey: Joi.string().trim().max(100).allow(null).optional(),
            Color: color.allow(null).optional(),
            Position: Joi.number().integer().allow(null).optional(),
            //  Arquiva e desarquiva — a mesma coluna que o DELETE zera. Sem ela o arquivamento
            //  era de mão única: a linha saía das listas e não havia rota que a trouxesse.
            Active: Joi.boolean().optional(),
        })),
    ]

    //  A lista COMPLETA de ids ativos, na ordem desejada — nunca um par (id, posição). O
    //  porquê está em sections/PUT/reorder.ts, e ele é o que as três recusas de lá defendem.
    //
    //  `min(1)`: uma lista vazia só passaria num espaço sem categoria nenhuma, e aí ela não
    //  pede nada. Sem `max`: o teto é o número de categorias do espaço, e quem o confere é a
    //  section — aqui não há como saber qual é.
    public readonly reorder = [
        joiController.validateBody(Joi.object({
            IdCategories: Joi.array().items(Joi.number().integer().required()).min(1).required(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdCategory: Joi.number().required(),
        })),
    ]
}

export const Categories_schema = new Schema()
