import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { Create } from "./sections/POST/create"
import { Reorder } from "./sections/PUT/reorder"
import { Update } from "./sections/PUT/update"

//  O IdWorkspace sai do res.locals, do mesmo jeito que o IdUser: o acessMiddleware resolve os
//  dois na entrada. A diferença é que este ainda não foi conferido — quem confere é a section.
class Controller {

    //  O IncludeArchived já chega booleano: o Joi da query converte a string "true" e põe
    //  false quando o parâmetro não vem — o mesmo caminho do IncludeCanceled de Expenses.
    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser, req.query))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdCategory), res.locals.IdUser, req.body))
    }

    //  Sem params: a rota não endereça UMA categoria — o corpo traz a lista inteira do espaço.
    reorder = async (req: Request, res: Response) => {
        res.json(await new Reorder().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdCategory), res.locals.IdUser))
    }
}

export const Categories_controller = new Controller()
