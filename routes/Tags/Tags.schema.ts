import Joi from "joi"
import { joiController } from "root/Utils/joiController"

//  A tag como ela sai na busca e embutida no gasto. Sem rota que a escreva: ela nasce do texto
//  digitado no gasto (Tags/sections/POST/resolveByName.ts).
export const tagResponse = Joi.object({
    IdTag: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    //  Autoria: quem usou a tag primeiro. Nada a ver com o IdUser de Persons, que é vínculo.
    IdUser: Joi.number().allow(null).required(),
    Name: Joi.string().required(),
    Color: Joi.string().allow(null).required(),
    Active: Joi.boolean().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    //  A única leitura: o input de sugestão enquanto se digita a tag do gasto.
    public readonly search = [
        joiController.validateQuery(Joi.object({
            //  100 é o tamanho da coluna: não faz sentido buscar por um termo maior que o nome.
            Search: Joi.string().trim().max(100).optional(),
        })),
        joiController.validateResponse(Joi.array().items(tagResponse)),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdTag: Joi.number().required(),
        })),
    ]
}

export const Tags_schema = new Schema()
