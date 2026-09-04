import { WorkspaceInvites_model } from "../../WorkspaceInvites.model"
import { WorkspacesAcessControl } from "../AcessControl.section"

//  "Quem eu convidei e ainda não entrou". É o que uma linha no banco permite e um token opaco
//  não permitiria — e uma das três razões de o convite ser linha e não JWT.
//
//  Só o dono lê, pela mesma razão de só o dono convidar: a lista é a de quem vai ganhar acesso.
export class GetInvites {
    public async run(SelectedIdWorkspace: number | undefined, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        //  O Hash sai na resposta de propósito: é o dono, e é ele quem entrega o link. Sem isso
        //  reenviar um convite exigiria revogar e criar outro.
        return await WorkspaceInvites_model.getPendingByWorkspace(membership.IdWorkspace)
    }
}
