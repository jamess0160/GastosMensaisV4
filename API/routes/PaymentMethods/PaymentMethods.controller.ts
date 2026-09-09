import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { Create } from "./sections/POST/create"
import { PayInvoice } from "./sections/POST/payInvoice"
import { Update } from "./sections/PUT/update"

class Controller {

    //  Não há GET: a forma de pagamento sai embutida na conta, no GET /Accounts. Ler as
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

    //  A fatura é (IdPaymentMethod, DueDate) — uma consulta, não um cadastro. É esta rota que
    //  tira o dinheiro do cartão da conta: no crédito, a perna sozinha não quita.
    payInvoice = async (req: Request, res: Response) => {
        res.json(await new PayInvoice().run(res.locals.IdWorkspace, Number(req.params.IdPaymentMethod), res.locals.IdUser, req.body.DueDate, true))
    }

    //  Existe pelo mesmo motivo que o unpay, e mais ainda: um clique errado aqui tira quarenta
    //  pagamentos do saldo de uma vez.
    unpayInvoice = async (req: Request, res: Response) => {
        res.json(await new PayInvoice().run(res.locals.IdWorkspace, Number(req.params.IdPaymentMethod), res.locals.IdUser, req.body.DueDate, false))
    }
}

export const PaymentMethods_controller = new Controller()
