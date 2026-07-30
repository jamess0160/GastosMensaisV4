import { Request, Response } from "express"
import { Base_Permissions_model } from "./Permissions.model"
import { PostPermissions } from "./sections/POST/postPermissions"

class Controller {

    private readonly PostPermissions = new PostPermissions()

    getGroupPermissions = async (req: Request, res: Response) => {
        res.json(await Base_Permissions_model.getByGroups([parseInt(req.params.IdUserGroupName)]))
    }

    postPermissions = async (req: Request, res: Response) => {

        let IdUser = res.locals.IdUser
        let SelectedKeys = req.body.SelectedKeys as string[]
        let IdUserGroupName = parseInt(req.params.IdUserGroupName)

        res.json(await this.PostPermissions.run(IdUserGroupName, SelectedKeys, IdUser))
    }
}

export const Base_Permissions_controller = new Controller()