import Joi from "joi"
import { joiController } from "root/Utils/joiController"

//  Exportado porque o rateio da entrada e o do gasto (etapas 4 e 5) devolvem a pessoa dentro
//  da linha: a forma dela é descrita aqui, uma vez só.
export const personResponse = Joi.object({
    IdPerson: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    Name: Joi.string().required(),
    //  O vínculo com um login, quando existe. Nulo é o caso comum — pessoa não precisa de
    //  conta no sistema para entrar num rateio.
    IdUser: Joi.number().allow(null).required(),
    Active: Joi.boolean().required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
})

class Schema {

    public readonly getByWorkspace = [
        joiController.validateResponse(Joi.array().items(personResponse)),
    ]

    //  Só o nome. O IdUser não é aceito de propósito: ver sections/POST/create.ts — é único no
    //  banco inteiro, e aceitá-lo do cliente deixaria consumir a vaga de outro usuário.
    public readonly create = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
        joiController.validateResponse(Joi.object({
            IdPerson: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdPerson: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdPerson: Joi.number().required(),
        })),
    ]
}

export const Persons_schema = new Schema()
