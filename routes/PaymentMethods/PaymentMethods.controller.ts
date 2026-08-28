import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { Create } from "./sections/POST/create"
import { Update } from "./sections/PUT/update"

class Controller {

    //  Não há GET: a forma de pagamento sai embutida na conta, no GET /Base/Accounts. Ler as
    //  duas coisas separadas obrigaria o cliente a remontar o vínculo que o modelo já tem.
    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, Number(req.params.IdPaymentMethod), res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(res.locals.IdWorkspace, Number(req.params.IdPaymentMethod), res.locals.IdUser))
    }
}

export const PaymentMethods_controller = new Controller()
