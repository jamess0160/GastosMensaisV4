import { Request, Response } from "express"
import { GetMonth } from "./sections/GET/getMonth"
import { GetExport } from "./sections/GET/getExport"
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

    //  **A única rota que passa o `res` para a section**, e é o que significa não responder
    //  JSON: quem escreve o corpo é quem monta o arquivo, em stream.
    getExport = async (req: Request, res: Response) => {
        await new GetExport().run(res.locals.IdWorkspace, res.locals.IdUser, res, {
            From: req.query.From as string | undefined,
            To: req.query.To as string | undefined,
        })
    }
}

export const Reports_controller = new Controller()
