import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { RemoveSeries } from "./sections/DELETE/removeSeries"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { GetUnique } from "./sections/GET/getUnique"
import { Create } from "./sections/POST/create"
import { Update } from "./sections/PUT/update"
import { UpdateSeries } from "./sections/PUT/updateSeries"

class Controller {

    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser, req.query))
    }

    getUnique = async (req: Request, res: Response) => {
        res.json(await new GetUnique().run(res.locals.IdWorkspace, Number(req.params.IdExpense), res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdExpense), res.locals.IdUser, req.body))
    }

    //  Da ocorrência escolhida para a frente: o passado guarda o valor que valeu.
    updateSeries = async (req: Request, res: Response) => {
        res.json(await new UpdateSeries().run(res.locals.IdWorkspace, Number(req.params.IdExpense), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdExpense), res.locals.IdUser))
    }

    removeSeries = async (req: Request, res: Response) => {
        res.json(await new RemoveSeries().run(res.locals.IdWorkspace, Number(req.params.IdExpense), res.locals.IdUser))
    }
}

export const Expenses_controller = new Controller()
