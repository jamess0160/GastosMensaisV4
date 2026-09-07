import { Request, Response } from "express"
import { CreateOwn } from "./sections/POST/createOwn"
import { GetSelf } from "./sections/GET/getSelf"
import { GetInviteByHash } from "./sections/GET/getInviteByHash"
import { GetInvites } from "./sections/GET/getInvites"
import { CreateInvite } from "./sections/POST/createInvite"
import { Join } from "./sections/POST/join"
import { Switch } from "./sections/POST/switch"
import { RevokeInvite } from "./sections/DELETE/revokeInvite"
import { Update } from "./sections/PUT/update"

class Controller {

    //  Sem res.locals.IdWorkspace: o workspace nasce aqui, não vem da sessão.
    create = async (req: Request, res: Response) => {
        res.json(await new CreateOwn().run(res.locals.IdUser, req.body))
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    //  O res vai junto porque trocar de workspace reemite o token da sessão
    switch = async (req: Request, res: Response) => {
        res.json(await new Switch().run(res, res.locals.IdUser, res.locals.RememberDevice, req.body))
    }

    createInvite = async (req: Request, res: Response) => {
        res.json(await new CreateInvite().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }

    getInvites = async (req: Request, res: Response) => {
        res.json(await new GetInvites().run(res.locals.IdWorkspace, res.locals.IdUser))
    }

    //  Sem res.locals: é rota pública, o que identifica o convite é o hash.
    getInviteByHash = async (req: Request, res: Response) => {
        res.json(await new GetInviteByHash().run(String(req.params.Hash)))
    }

    //  Não recebe IdWorkspace: ele vem da linha do convite, conferida no servidor.
    join = async (req: Request, res: Response) => {
        res.json(await new Join().run(res.locals.IdUser, req.body))
    }

    revokeInvite = async (req: Request, res: Response) => {
        res.json(await new RevokeInvite().run(res.locals.IdWorkspace, Number(req.params.IdWorkspaceInvite), res.locals.IdUser))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(res.locals.IdWorkspace, res.locals.IdUser, req.body))
    }
}

export const Workspaces_controller = new Controller()
