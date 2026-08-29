import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { Create } from "./sections/POST/create"
import { Update } from "./sections/PUT/update"

class Controller {

    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdPerson), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdPerson), res.locals.IdUser))
    }
}

export const Persons_controller = new Controller()
