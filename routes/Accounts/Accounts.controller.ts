import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { Create } from "./sections/POST/create"
import { Update } from "./sections/PUT/update"

//  O IdWorkspace sai do res.locals, do mesmo jeito que o IdUser: o acessMiddleware resolve os
//  dois na entrada. A diferença é que este ainda não foi conferido — quem confere é a section.
class Controller {

    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdAccount), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdAccount), res.locals.IdUser))
    }
}

export const Accounts_controller = new Controller()
