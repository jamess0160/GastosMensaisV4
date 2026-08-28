import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { color } from "root/Utils/joiSchemas"

//  A linha de Categories, com os filhos dentro. O Joi.link resolve a recursão: sem ele a
//  árvore só poderia ser descrita até uma profundidade fixa, e a próxima subcategoria cairia
//  como "dados de saída inválidos".
//
//  IdWorkspace nulo é a pré-definida do sistema — é por ele que o cliente sabe que aquela
//  linha não abre para edição, então ele é parte da resposta, não detalhe interno.
export const categoryResponse = Joi.object({
    IdCategory: Joi.number().required(),
    IdWorkspace: Joi.number().allow(null).required(),
    IdParentCategory: Joi.number().allow(null).required(),
    Description: Joi.string().required(),
    IconKey: Joi.string().allow(null).required(),
    Color: Joi.string().allow(null).required(),
    Position: Joi.number().allow(null).required(),
    Active: Joi.boolean().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
    //  Sempre presente, mesmo vazia: o cliente não precisa testar a existência do campo para
    //  descer a árvore. É o que o Utils.buildTree devolve.
    TreeItems: Joi.array().items(Joi.link("#category")).required(),
}).id("category")

class Schema {

    //  Sem validateParams em nenhuma rota daqui: o IdWorkspace saiu do caminho e vem do token
    //  da sessão, e o único parâmetro que sobrou é o id da própria linha.
    public readonly getByWorkspace = [
        joiController.validateResponse(Joi.array().items(categoryResponse)),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            //  O pai é conferido na section: precisa estar visível ao workspace (a própria ou
            //  uma global). O schema só garante que é um id.
            IdParentCategory: Joi.number().allow(null).default(null),
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
    //  default(null) aqui apagaria o ícone em todo PUT que só quisesse renomear.
    public readonly update = [
        joiController.validateParams(Joi.object({
            IdCategory: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Description: Joi.string().trim().max(255).required(),
            //  Aceita null: é assim que uma subcategoria volta a ser raiz. Omitir mantém o pai.
            IdParentCategory: Joi.number().allow(null).optional(),
            IconKey: Joi.string().trim().max(100).allow(null).optional(),
            Color: color.allow(null).optional(),
            Position: Joi.number().integer().allow(null).optional(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdCategory: Joi.number().required(),
        })),
    ]
}

export const Categories_schema = new Schema()
