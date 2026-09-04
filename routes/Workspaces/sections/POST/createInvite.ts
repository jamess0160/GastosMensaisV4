import { APIError } from "root/Utils/Logs"
import { Users_model } from "root/routes/Users/Users.model"
import { WorkspaceInvites_model } from "../../WorkspaceInvites.model"
import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { InviteHash } from "../InviteHash.section"
import { WorkspacesNamespace } from "../types"

//  Cria o convite e devolve o hash. Quem entrega o link é o usuário — a API não manda e-mail,
//  e é isso que mantém esta etapa fora da dependência de infra que o projeto não tem. Quando o
//  envio existir, ele vira um segundo canal de entrega do mesmo hash, sem mudar nada aqui.
export class CreateInvite {
    public async run(SelectedIdWorkspace: number | undefined, IdUser: number, body: WorkspacesNamespace.CreateInvitePayload) {
        //  Só o dono convida: um editor que pudesse convidar promoveria terceiros ao próprio
        //  nível sem o dono saber.
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        await this.assertNotMemberYet(membership.IdWorkspace, body.Email)

        let Hash = InviteHash.generate()
        let ExpiresAt = InviteHash.buildExpiration()

        //  Convite repetido para o mesmo e-mail RENOVA o existente, com hash e validade novos,
        //  em vez de criar um segundo. Dois links vivos para o mesmo convite é o pior caso
        //  possível: revogar um deixaria o outro funcionando.
        let pending = await WorkspaceInvites_model.getPendingByEmail(membership.IdWorkspace, body.Email)

        if (pending) {
            await WorkspaceInvites_model.update(pending.IdWorkspaceInvite, {
                Hash,
                ExpiresAt,
                Role: body.Role,
                IdInviterUser: IdUser,
            })

            return { Hash, ExpiresAt }
        }

        await WorkspaceInvites_model.create({
            IdWorkspace: membership.IdWorkspace,
            IdInviterUser: IdUser,
            Email: body.Email,
            Role: body.Role,
            Hash,
            ExpiresAt,
        })

        return { Hash, ExpiresAt }
    }

    //  Convidar quem já é membro é erro de quem convida, não do convidado — e o convite
    //  morreria no unique(IdWorkspace, IdUser) de WorkspaceMembers só na hora do aceite, com
    //  o link já entregue. Responder aqui é o que evita isso.
    //
    //  Só dá para conferir quando o e-mail já tem conta: convite para quem ainda não se
    //  cadastrou não tem como ser membro de nada.
    private async assertNotMemberYet(IdWorkspace: number, Email: string) {
        let user = await Users_model.getByEmailIncludingInactive(Email)

        if (!user) return

        let membership = await WorkspaceMembers_model.getMembership(IdWorkspace, user.IdUser)

        if (membership) {
            throw new APIError({
                msg: "Esse usuário já é membro deste workspace.",
                status: 406,
                data: { IdWorkspace, Email },
            })
        }
    }
}
