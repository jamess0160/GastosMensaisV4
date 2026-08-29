import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { Update } from "./sections/PUT/update"

class Controller {

    //  Não há POST: o mês nasce junto com o cadastro do orçamento (POST /Base/Budgets), dentro
    //  da transaction dele — e é essa escrita que a rotina mensal vai passar a fazer.
    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdBudgetPeriod), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdBudgetPeriod), res.locals.IdUser))
    }
}

export const BudgetPeriods_controller = new Controller()
