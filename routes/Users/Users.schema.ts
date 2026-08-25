import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly validateLogin = [
        joiController.validateBody(Joi.object({
            login: Joi.string().trim().lowercase().required(),
            password: Joi.string().trim().required(),
        })),
    ]

    //  Espelha a linha de Users, menos o Password: o hash nunca sai da API.
    //  As datas chegam aqui como Date (o res.json só serializa depois da validação).
    public readonly getSelf = [
        joiController.validateResponse(Joi.object({
            IdUser: Joi.number().required(),
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().required(),
            Phone: Joi.number().required(),
            LastLogin: Joi.date().required(),
            TrialStartAt: Joi.date().required(),
            TrialEndAt: Joi.date().allow(null).required(),
            Active: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
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
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().required(),
            Phone: Joi.number().required(),
        })),
    ]

    public readonly updatePassword = [
        joiController.validateBody(Joi.object({
            oldPassword: Joi.string().trim().required(),
            newPassword: Joi.string().trim().required(),
        })),
    ]
}

export const Users_schema = new Schema()