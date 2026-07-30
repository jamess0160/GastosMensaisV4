import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    public readonly getGroupPermissions = [
        joiController.validateParams(Joi.object({
            IdUserGroupName: Joi.string().required()
        }))
    ]

    public readonly postPermissions = [
        joiController.validateParams(Joi.object({
            IdUserGroupName: Joi.string().required()
        })),
        joiController.validateBody(Joi.object({
            SelectedKeys: Joi.array().items(Joi.string()).required().min(0)
        }))
    ]
}

export const Base_Permissions_schema = new Schema()