import { APIError } from "root/Utils/Logs"
import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { WorkspacesNamespace } from "../types"

//  Trocar o papel de quem JÁ é membro.
//
//  Antes disto o papel só se decidia no convite e era imutável depois do aceite: promover quem
//  entrou como viewer exigia remover e convidar de novo — e como a matrícula é apagada de
//  verdade (não há Active em WorkspaceMembers), isso perdia a data de entrada.
//
//  Só o dono (assertRole owner), pelo mesmo motivo do convite: um editor que pudesse promover
//  terceiros ao próprio nível dispensaria o dono da decisão.
//
//  'owner' não é aceito no corpo, e quem recusa isso é o Joi: promover alguém a dono é
//  TRANSFERIR a propriedade, que tem regra própria. Aqui só se anda entre editor e viewer.
export class UpdateMember {
    public async run(SelectedIdWorkspace: number | undefined, IdWorkspaceMember: number, IdUser: number, body: WorkspacesNamespace.UpdateMemberPayload) {
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        //  O IdWorkspace entra junto na busca: o id da matrícula chega do cliente e é
        //  sequencial, então uma matrícula conferida no próprio tenant deixaria rebaixar o
        //  membro do vizinho. 406 "não encontrado", como em toda leitura escopada — um 404
        //  confirmaria que a matrícula existe em algum lugar.
        let target = await WorkspaceMembers_model.getUnique(membership.IdWorkspace, IdWorkspaceMember)

        if (!target) {
            throw new APIError({
                msg: "Membro não encontrado!",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        //  O dono não muda o próprio papel. Um espaço sem dono não é estado do qual se volta —
        //  ninguém poderia mais convidar, remover ou transferir —, e a guarda é comparar a
        //  matrícula alvo com a de quem chamou. Comparar IdUser daria no mesmo hoje, mas a
        //  matrícula é o que a rota endereça.
        if (target.IdWorkspaceMember === membership.IdWorkspaceMember) {
            throw new APIError({
                msg: "Você não pode mudar o seu próprio papel. Para passar o espaço a outra pessoa, transfira a propriedade.",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        await WorkspaceMembers_model.update(target.IdWorkspaceMember, { Role: body.Role })

        return { msg: "Papel atualizado com sucesso" }
    }
}
