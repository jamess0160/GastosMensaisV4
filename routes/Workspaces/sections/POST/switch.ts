import { Response } from "express"
import { APIError } from "root/Utils/Logs"
import { AcessControl } from "root/routes/Users/sections/AcessControl.section"
import { Workspaces_model } from "../../Workspaces.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { WorkspacesNamespace } from "../types"

//  Troca o workspace da sessão.
//
//  É a única rota que recebe um IdWorkspace escrito pelo cliente — nas demais ele vem de dentro
//  do token. Por isso a matrícula é conferida aqui antes de qualquer coisa: o que sai deste
//  ponto vira token assinado, e um token emitido para um workspace alheio seria aceito por
//  todas as rotas seguintes como se fosse legítimo.
//
//  Trocar de workspace reemite o token, porque é ele que carrega a seleção. O token anterior
//  continua válido até expirar, apontando para o workspace antigo — o que é correto: ele prova
//  a mesma identidade e uma seleção que na época era legítima.
export class Switch {
    public async run(res: Response, IdUser: number, RememberDevice: boolean, body: WorkspacesNamespace.SwitchWorkspacePayload) {
        await WorkspacesAcessControl.assertMember(body.IdWorkspace, IdUser)

        let workspace = await Workspaces_model.getUnique(body.IdWorkspace)

        //  A matrícula acabou de responder que existe: chegar aqui sem a linha significaria
        //  matrícula órfã, que é estado corrompido e não um erro do cliente.
        if (!workspace) {
            throw new APIError({
                msg: "Workspace não encontrado!",
                status: 406,
                data: { IdWorkspace: body.IdWorkspace, IdUser },
            })
        }

        //  A duração vem do token que chegou, nunca do default: reemitir com 24h aqui
        //  rebaixaria em silêncio uma sessão de 30 dias, e o usuário seria deslogado dias
        //  depois sem entender por quê. O relógio recomeça, e isso é o esperado — quem está
        //  usando o app agora não deve perder a sessão por ter trocado de workspace.
        AcessControl.setTokenCookie(res, IdUser, workspace.IdWorkspace, RememberDevice)

        return workspace
    }
}
