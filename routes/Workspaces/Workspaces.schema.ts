import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly getSelf = [
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdWorkspace: Joi.number().required(),
            Name: Joi.string().trim().required(),
            IdOwnerUser: Joi.number().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        }))),
    ]

    //  Única rota que recebe IdWorkspace do cliente: é ela que decide qual vai para o token.
    public readonly switch = [
        joiController.validateBody(Joi.object({
            IdWorkspace: Joi.number().required(),
        })),
        joiController.validateResponse(Joi.object({
            IdWorkspace: Joi.number().required(),
            Name: Joi.string().trim().required(),
            IdOwnerUser: Joi.number().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        })),
    ]

    //  Sem validateParams: o workspace editado é o da sessão, que vem do token.
    public readonly update = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
    ]
}

export const Workspaces_schema = new Schema()
