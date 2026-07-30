import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly validateLogin = [
        joiController.validateParams(Joi.object({
            login: Joi.string().trim().lowercase().required(),
            password: Joi.string().trim().required(),
        })),
    ]

    public readonly getToRegister = []

    public readonly getSelf = []

    public readonly checkLogin = [
        joiController.validateParams(Joi.object({
            login: Joi.string().trim().lowercase().required(),
        })),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().required(),
            Login: Joi.string().trim().lowercase().required(),
            Cellphone: Joi.string().trim().required(),
            UserGroups: Joi.array().items(Joi.string().trim()).required(),
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

    public readonly delete = [
        joiController.validateParams(Joi.object({
            IdUser: Joi.number().required(),
        })),
    ]
}

export const Base_Users_schema = new Schema()