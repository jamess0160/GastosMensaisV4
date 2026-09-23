import { Request, Response } from "express"
import { GetByMonth } from "./sections/GET/getByMonth"
import { Allocate } from "./sections/POST/allocate"
import { Clone } from "./sections/POST/clone"
import { Create } from "./sections/POST/create"
import { Remove } from "./sections/DELETE/remove"
import { Update } from "./sections/PUT/update"

class Controller {

    getByMonth = async (req: Request, res: Response) => {
        res.json(await new GetByMonth().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.ReferenceMonth as string))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    allocate = async (req: Request, res: Response) => {
        res.json(await new Allocate().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    clone = async (req: Request, res: Response) => {
        res.json(await new Clone().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdBudgetPeriod), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdBudgetPeriod), res.locals.IdUser))
    }
}

export const BudgetPeriods_controller = new Controller()
