import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Users_model } from "root/routes/Users/Users.model"
import { InviteAcceptance } from "../InviteAcceptance.section"
import { WorkspacesNamespace } from "../types"

//  Aceite de quem JÁ tem conta. O outro caminho de aceite é o cadastro (POST /Users com
//  InviteHash); as regras dos dois moram na InviteAcceptance, e não aqui.
//
//  A rota NÃO reemite o token. Aceitar dá matrícula, não troca a sessão: quem quiser operar no
//  workspace novo chama POST /Workspaces/switch, que é a rota que existe para isso. Juntar as
//  duas faria o aceite trocar o workspace debaixo da tela que o usuário estava usando.
export class Join {
    public async run(IdUser: number, body: WorkspacesNamespace.JoinWorkspacePayload) {
        let invite = await InviteAcceptance.resolve(body.Hash)

        let user = await Users_model.getUnique(IdUser)

        //  O token é assinado, então o usuário existia quando ele foi emitido; chegar aqui sem
        //  a linha é conta desativada ou apagada depois disso.
        if (!user) {
            throw new APIError({
                msg: "Usuário não encontrado!",
                status: 406,
                data: { IdUser },
            })
        }

        //  O e-mail da sessão, não o do corpo: é a conta que está aceitando de verdade.
        InviteAcceptance.assertEmail(invite, user.Email)

        let IdWorkspace = await KnexTransaction(async (tx) => {
            return await InviteAcceptance.accept(tx, invite, IdUser, user!.Name)
        })

        return { IdWorkspace }
    }
}
