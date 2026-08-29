import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { GetUnique } from "./sections/GET/getUnique"
import { Create } from "./sections/POST/create"
import { Receive } from "./sections/POST/receive"
import { Update } from "./sections/PUT/update"

class Controller {

    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser, req.query))
    }

    getUnique = async (req: Request, res: Response) => {
        res.json(await new GetUnique().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser, req.body))
    }

    receive = async (req: Request, res: Response) => {
        res.json(await new Receive().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser))
    }
}

export const Inflows_controller = new Controller()
