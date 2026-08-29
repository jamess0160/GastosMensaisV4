import { Request, Response } from "express"
import { Pay } from "./sections/POST/pay"

class Controller {

    //  Não há GET nem POST de cadastro: a perna nasce junto com o gasto e sai embutida no GET
    //  dele. O que existe por aqui é o verbo que move saldo.
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
