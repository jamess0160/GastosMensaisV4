import { Request, Response } from "express"
import { GetSelf } from "./sections/GET/getSelf"
import { Update } from "./sections/PUT/update"

class Controller {

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(Number(req.params.IdWorkspace), res.locals.IdUser, req.body))
    }
}

export const Workspaces_controller = new Controller()
