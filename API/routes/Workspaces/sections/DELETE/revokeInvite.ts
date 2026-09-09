import { APIError } from "root/Utils/Logs"
import { WorkspaceInvites_model } from "../../WorkspaceInvites.model"
import { WorkspacesAcessControl } from "../AcessControl.section"

//  Revoga o convite: Status = 'revoked'.
//
//  É a razão de o convite ser uma linha e não um JWT — um token de convite vale até expirar, e
//  quem recebeu o link continuaria entrando depois de o dono mudar de ideia. Aqui o link morre
//  na hora, porque quem responde por ele é o banco.
//
//  Não é delete físico nem Active: a tabela tem Status, como Inflows e Expenses. E manter a
//  linha guarda a resposta do "por que meu link parou de funcionar".
export class RevokeInvite {
    public async run(SelectedIdWorkspace: number | undefined, IdWorkspaceInvite: number, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        //  O IdWorkspace entra junto na busca: o id chega do cliente e é sequencial, então uma
        //  matrícula conferida no próprio tenant deixaria revogar o convite do vizinho.
        let invite = await WorkspaceInvites_model.getUnique(membership.IdWorkspace, IdWorkspaceInvite)

        if (!invite) {
            throw new APIError({
                msg: "Convite não encontrado!",
                status: 406,
                data: { IdWorkspaceInvite, IdUser },
            })
        }

        //  Revogar o que já foi aceito não desfaz a matrícula — quem tira membro é a gestão de
        //  membros, que continua na etapa 9 do ROADMAP. Dizer isso é melhor que fingir sucesso.
        if (invite.Status !== "pending") {
            throw new APIError({
                msg: "Este convite não está mais pendente.",
                status: 406,
                data: { IdWorkspaceInvite, Status: invite.Status },
            })
        }

        await WorkspaceInvites_model.update(invite.IdWorkspaceInvite, { Status: "revoked" })

        return { msg: "Convite revogado com sucesso" }
    }
}
