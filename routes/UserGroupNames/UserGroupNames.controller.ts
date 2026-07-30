import { Request, Response } from "express"
import { Base_UserGroupNames_model } from './UserGroupNames.model'

class Controller {

    getAllActive = async (req: Request, res: Response) => {
        res.json(await Base_UserGroupNames_model.getAllActive())
    }

    getToRegister = async (req: Request, res: Response) => {
        res.json(await Base_UserGroupNames_model.getAllActive()
            .joinActives({
                UserGroupTypes: {
                    selfPath: "IdUserGroupType", type: "single"
                }
            })
        )
    }

    create = async (req: Request, res: Response) => {
        res.json(await Base_UserGroupNames_model.create(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await Base_UserGroupNames_model.update(parseInt(req.params.IdUserGroupName), req.body))
    }

    delete = async (req: Request, res: Response) => {
        res.json(await Base_UserGroupNames_model.delete(parseInt(req.params.IdUserGroupName)))
    }
}

export const Base_UserGroupNames_controller = new Controller()