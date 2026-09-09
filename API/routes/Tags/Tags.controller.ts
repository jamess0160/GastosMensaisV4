import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { Search } from "./sections/GET/search"

class Controller {

    //  Só duas rotas: a tag não se cadastra nem se edita — ela nasce com o gasto e some quando
    //  não serve mais. Ver Tags.route.ts.
    search = async (req: Request, res: Response) => {
        res.json(await new Search().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.Search as string | undefined))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdTag), res.locals.IdUser))
    }
}

export const Tags_controller = new Controller()
