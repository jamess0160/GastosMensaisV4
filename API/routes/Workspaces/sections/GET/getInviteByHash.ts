import { Users_model } from "root/routes/Users/Users.model"
import { Workspaces_model } from "../../Workspaces.model"
import { InviteAcceptance } from "../InviteAcceptance.section"

//  A tela de aceite, antes de qualquer sessão: é ela que diz "Fulano te convidou para o
//  workspace X, entre com este e-mail".
//
//  Rota pública porque quem recebeu o link ainda não tem conta — exigir token aqui obrigaria a
//  cadastrar primeiro e descobrir o convite depois.
//
//  NENHUM id na resposta. Quem tem o hash já tem o convite; o que não pode acontecer é a rota
//  virar sonda para descobrir workspace por id — que é exatamente o buraco que ela fecha.
export class GetInviteByHash {
    public async run(Hash: string) {
        let invite = await InviteAcceptance.resolve(Hash)

        let workspace = await Workspaces_model.getUnique(invite.IdWorkspace)
        let inviter = await Users_model.getUnique(invite.IdInviterUser)

        return {
            WorkspaceName: workspace?.Name ?? "",
            InviterName: inviter?.Name ?? "",
            //  O e-mail convidado volta para a tela poder dizer "entre com esta conta" — é o
            //  mesmo dado que o usuário recebeu no link, não uma revelação.
            Email: invite.Email,
            Role: invite.Role,
            ExpiresAt: invite.ExpiresAt,
        }
    }
}
