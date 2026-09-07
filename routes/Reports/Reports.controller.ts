import { Request, Response } from "express"
import { GetMonth } from "./sections/GET/getMonth"
import { GetStatement } from "./sections/GET/getStatement"

//  Fino como todos os outros: tira os parâmetros do req/res.locals e delega. O IdWorkspace vem
//  do token e ainda não foi conferido — quem confere é a section.
class Controller {

    getMonth = async (req: Request, res: Response) => {
        res.json(await new GetMonth().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.ReferenceMonth as string | undefined))
    }

    getStatement = async (req: Request, res: Response) => {
        res.json(await new GetStatement().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.ReferenceMonth as string | undefined))
    }
}

export const Reports_controller = new Controller()
