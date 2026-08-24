import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly validateLogin = [
        joiController.validateParams(Joi.object({
            login: Joi.string().trim().lowercase().required(),
            password: Joi.string().trim().required(),
        })),
    ]

    public readonly getSelf = [
        joiController.validateResponse(Joi.object({
            IdUser: Joi.number().required(),
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().required(),
            Password: Joi.string().trim().required(),
            Phone: Joi.string().trim().required(),
            LastLogin: Joi.string().trim().required(),
            IdUserChange: Joi.number().required(),
            CreatedAt: Joi.string().trim().required(),
            UpdatedAt: Joi.string().trim().required(),
        })),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().required(),
            Password: Joi.string().trim().required(),
            Phone: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdUser: Joi.number().required(),
        })),
        ...this.create
    ]

    public readonly updatePassword = [
        joiController.validateParams(Joi.object({
            newPassword: Joi.string().trim().required(),
        })),
    ]
}

export const Users_schema = new Schema()