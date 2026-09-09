import { Knex } from "knex"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { CreateSelf as CreateSelfPerson } from "root/routes/Persons/sections/POST/createSelf"
import { class_WorkspaceInvites_model, WorkspaceInvites_model } from "../WorkspaceInvites.model"
import { Create as CreateMembership } from "./POST/create"

//  As regras do aceite, num lugar só, porque há DOIS caminhos até ele: o usuário que já tem
//  conta (POST /Workspaces/join) e o que se cadastra pelo link (POST /Users, com InviteHash).
//  Duplicar a conferência nos dois é o jeito de eles divergirem depois — e o que divergiria é
//  justamente a checagem de e-mail, que é a razão de o desenho inteiro existir.
class Controller {

    //  Resolve o convite pelo hash e responde por que ele não serve, quando não serve. Cada
    //  estado tem msg própria de propósito: a tela de aceite precisa dizer "expirou, peça outro"
    //  e não "não encontrado", que mandaria o usuário procurar o link errado.
    public async resolve(Hash: string) {
        let invite = await WorkspaceInvites_model.getByHash(Hash)

        if (!invite) {
            throw new APIError({
                msg: "Convite não encontrado.",
                status: 406,
            })
        }

        if (invite.Status === "revoked") {
            throw new APIError({
                msg: "Este convite foi revogado.",
                status: 406,
                data: { IdWorkspaceInvite: invite.IdWorkspaceInvite },
            })
        }

        //  O Status é a resposta amigável ao aceite duplo; a garantia de verdade é o
        //  unique(IdWorkspace, IdUser) de WorkspaceMembers, que já existia.
        if (invite.Status === "accepted") {
            throw new APIError({
                msg: "Este convite já foi utilizado.",
                status: 406,
                data: { IdWorkspaceInvite: invite.IdWorkspaceInvite },
            })
        }

        if (new Date(invite.ExpiresAt).getTime() <= Date.now()) {
            throw new APIError({
                msg: "Este convite expirou. Peça um novo ao dono do workspace.",
                status: 406,
                data: { IdWorkspaceInvite: invite.IdWorkspaceInvite },
            })
        }

        return invite
    }

    //  O e-mail é o que impede o link repassado.
    //
    //  O link é compartilhável POR DESENHO — é uma URL que o usuário manda por WhatsApp —,
    //  então o segredo do hash sozinho não basta: quem recebesse o encaminhamento entraria.
    //  A comparação é direta porque os dois lados são gravados em minúsculas (o Joi de Users e
    //  o do convite forçam lowercase); o trim/lowercase aqui é cinto e suspensório.
    public assertEmail(invite: Database.WorkspaceInvites, Email: string) {
        if (invite.Email.trim().toLowerCase() !== Email.trim().toLowerCase()) {
            throw new APIError({
                msg: "Este convite foi enviado para outro e-mail. Entre com a conta que recebeu o convite.",
                status: 406,
                data: { IdWorkspaceInvite: invite.IdWorkspaceInvite },
            })
        }
    }

    //  O aceite em si, sempre dentro de uma transaction de quem chama: a matrícula, a Person do
    //  convidado no workspace novo e a baixa do convite caem ou passam juntas. Um convite
    //  marcado como aceito sem matrícula deixaria o usuário de fora e sem como tentar de novo.
    //
    //  O Role vem da linha do convite, nunca do cliente.
    public async accept(tx: Knex.Transaction, invite: Database.WorkspaceInvites, IdUser: number, Name: string) {
        await new CreateMembership(tx).run(IdUser, Name, invite.IdWorkspace, invite.Role)

        //  A createSelf continua sendo o ÚNICO lugar que escreve o IdUser de uma pessoa, e o
        //  valor não vem do corpo. É esta chamada que a migration do índice destravou: até
        //  agora Persons tinha unique(IdUser) global, e o convidado ficaria sem pessoa no
        //  workspace novo — ou seja, um membro que não pode receber um centavo de rateio.
        //
        //  Ela pula (não renomeia, não recusa) quando o nome já está tomado no workspace: um
        //  homônimo não pode derrubar o aceite inteiro.
        await new CreateSelfPerson(tx).run(invite.IdWorkspace, IdUser, Name)

        await new class_WorkspaceInvites_model(tx).update(invite.IdWorkspaceInvite, {
            Status: "accepted",
            AcceptedAt: new Date(),
            IdAcceptedUser: IdUser,
        })

        return invite.IdWorkspace
    }
}

export const InviteAcceptance = new Controller()
