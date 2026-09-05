import { Request, Response } from "express"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { Pay } from "./sections/POST/pay"

class Controller {

    //  A lista do que **cai** no período, que não é a lista do que foi comprado nele — ver
    //  sections/GET/getByWorkspace.ts. Não há POST de cadastro: a perna nasce com o gasto.
    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser, req.query))
    }

    pay = async (req: Request, res: Response) => {
        res.json(await new Pay().run(res.locals.IdWorkspace, Number(req.params.IdExpensePayment), res.locals.IdUser, true))
    }

    //  Desquitar existe porque quitar errado precisa de conserto: sem ele, um clique a mais
    //  tiraria dinheiro da conta sem volta.
    unpay = async (req: Request, res: Response) => {
        res.json(await new Pay().run(res.locals.IdWorkspace, Number(req.params.IdExpensePayment), res.locals.IdUser, false))
    }
}

export const ExpensePayments_controller = new Controller()
