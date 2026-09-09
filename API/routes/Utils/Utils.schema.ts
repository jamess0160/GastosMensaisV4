import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly getServerTime = []

    public readonly health = []

    public readonly reload = []

    public readonly logs = [
        joiController.validateBody(Joi.object({
            Type: Joi.string().valid("info", "error", "userError", "untracked", "telemetry"),
            Log: Joi.object({
                msg: Joi.string().trim().required(),
                rota: Joi.string().trim().optional(),
                methodo: Joi.string().trim().optional(),
                user_id: Joi.number().integer().positive().optional(),
                stack: Joi.array().items(Joi.string()).optional(),
                data: Joi.any().optional(),
                fullError: Joi.any().optional(),
                errorMessage: Joi.string().trim().optional(),
            })
        }))
    ]
}

export const Base_Utils_schema = new Schema()