import { Request, Response } from "express"
import { GetByMonth } from "./sections/GET/getByMonth"
import { Create } from "./sections/POST/create"

class Controller {

    //  Não há PUT nem DELETE por aqui: o que se edita é o mês, e o mês é BudgetPeriods.
    getByMonth = async (req: Request, res: Response) => {
        res.json(await new GetByMonth().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.ReferenceMonth as string))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }
}

export const Budgets_controller = new Controller()
