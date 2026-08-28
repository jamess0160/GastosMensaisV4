import { Request, Response } from "express"
import { GetSelf } from "./sections/GET/getSelf"
import { Switch } from "./sections/POST/switch"
import { Update } from "./sections/PUT/update"

class Controller {

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    //  O res vai junto porque trocar de workspace reemite o token da sessão
    switch = async (req: Request, res: Response) => {
        res.json(await new Switch().run(res, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }
}

export const Workspaces_controller = new Controller()
