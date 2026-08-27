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

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdWorkspace: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
    ]
}

export const Workspaces_schema = new Schema()
