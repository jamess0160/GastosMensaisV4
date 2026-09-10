import { Request, Response } from "express"
import { CreateOwn } from "./sections/POST/createOwn"
import { GetSelf } from "./sections/GET/getSelf"
import { GetInviteByHash } from "./sections/GET/getInviteByHash"
import { GetInvites } from "./sections/GET/getInvites"
import { GetMembers } from "./sections/GET/getMembers"
import { CreateInvite } from "./sections/POST/createInvite"
import { Join } from "./sections/POST/join"
import { Switch } from "./sections/POST/switch"
import { TransferOwnership } from "./sections/POST/transferOwnership"
import { Leave } from "./sections/DELETE/leave"
import { RemoveMember } from "./sections/DELETE/removeMember"
import { RevokeInvite } from "./sections/DELETE/revokeInvite"
import { Update } from "./sections/PUT/update"
import { UpdateMember } from "./sections/PUT/updateMember"

class Controller {

    //  Sem res.locals.IdWorkspace: o workspace nasce aqui, não vem da sessão.
    create = async (req: Request, res: Response) => {
        res.json(await new CreateOwn().run(res.locals.IdUser, req.body))
    }

    //  O IdWorkspace vai junto porque a resposta marca qual da lista é o da sessão — e isso é
    //  informação do token, não da tabela.
    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser, res.locals.IdWorkspace))
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

    //  O IdUser vai junto por dois motivos: ele é quem a matrícula é conferida contra, e é
    //  ele que marca o IsSelf de uma das linhas.
    getMembers = async (req: Request, res: Response) => {
        res.json(await new GetMembers().run(res.locals.IdWorkspace, res.locals.IdUser))
    }

    //  A matrícula alvo vem do caminho; o IdUser vai junto porque é ele que o assertRole
    //  confere e é contra a matrícula DELE que a guarda do "próprio papel" compara.
    updateMember = async (req: Request, res: Response) => {
        res.json(await new UpdateMember().run(res.locals.IdWorkspace, Number(req.params.IdWorkspaceMember), res.locals.IdUser, req.body))
    }

    //  Mesma forma do updateMember: a matrícula alvo vem do caminho, e o IdUser vai junto
    //  porque é ele que o assertRole confere e é contra a matrícula DELE que a guarda do
    //  "não se remove a si mesmo" compara. Sem corpo — não há nada a receber.
    removeMember = async (req: Request, res: Response) => {
        res.json(await new RemoveMember().run(res.locals.IdWorkspace, Number(req.params.IdWorkspaceMember), res.locals.IdUser))
    }

    //  Mesma forma do updateMember e do removeMember: a matrícula de QUEM RECEBE vem do
    //  caminho, e o IdUser vai junto porque é ele que o assertRole confere e é contra a
    //  matrícula DELE que a guarda do "não para si mesmo" compara — e é ela que vira 'editor'.
    //  Sem corpo: transferir não tem opção.
    transferOwnership = async (req: Request, res: Response) => {
        res.json(await new TransferOwnership().run(res.locals.IdWorkspace, Number(req.params.IdWorkspaceMember), res.locals.IdUser))
    }

    //  Sem id nenhum do cliente: a matrícula apagada é a da própria sessão, e o par
    //  (workspace do token, usuário do token) é o que a identifica. Sem corpo, como o
    //  removeMember — sair não tem opção.
    leave = async (req: Request, res: Response) => {
        res.json(await new Leave().run(res.locals.IdWorkspace, res.locals.IdUser))
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
