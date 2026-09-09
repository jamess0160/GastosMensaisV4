import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { GetByWorkspace } from "./sections/GET/getByWorkspace"
import { GetUnique } from "./sections/GET/getUnique"
import { Create } from "./sections/POST/create"
import { CreateBatch } from "./sections/POST/createBatch"
import { Receive } from "./sections/POST/receive"
import { Update } from "./sections/PUT/update"

class Controller {

    getByWorkspace = async (req: Request, res: Response) => {
        res.json(await new GetByWorkspace().run(res.locals.IdWorkspace, res.locals.IdUser, req.query))
    }

    getUnique = async (req: Request, res: Response) => {
        res.json(await new GetUnique().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    //  Os itens saem de dentro da chave Inflows: o corpo é um objeto, não um array solto, para
    //  caber um campo novo depois sem quebrar quem já chama.
    createBatch = async (req: Request, res: Response) => {
        res.json(await new CreateBatch().run(res.locals.IdWorkspace, res.locals.IdUser, req.body.Inflows))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser, req.body))
    }

    receive = async (req: Request, res: Response) => {
        res.json(await new Receive().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser, true))
    }

    //  Desfazer existe porque receber errado precisa de conserto — a simétrica que faltava,
    //  como o unpay é a do pay. Mesma section, com o booleano trocado.
    unreceive = async (req: Request, res: Response) => {
        res.json(await new Receive().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser, false))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdInflow), res.locals.IdUser))
    }
}

export const Inflows_controller = new Controller()
