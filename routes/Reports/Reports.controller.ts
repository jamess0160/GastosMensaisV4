import { Request, Response } from "express"
import { GetMonth } from "./sections/GET/getMonth"

//  Fino como todos os outros: tira os parâmetros do req/res.locals e delega. O IdWorkspace vem
//  do token e ainda não foi conferido — quem confere é a section.
class Controller {

    getMonth = async (req: Request, res: Response) => {
        res.json(await new GetMonth().run(res.locals.IdWorkspace, res.locals.IdUser, req.query.ReferenceMonth as string | undefined))
    }
}

export const Reports_controller = new Controller()
