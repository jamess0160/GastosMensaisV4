import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Workspaces_model } from "../../Workspaces.model"
import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"

//  Passar a propriedade do espaço a outro membro.
//
//  'owner' é papel de UMA pessoa e, até aqui, não se movia: quem criou o espaço era dono para
//  sempre. O updateMember recusa 'owner' no corpo e recusa a própria matrícula, e o leave
//  recusa o dono — as três recusas mandam transferir a propriedade, e esta é a rota que elas
//  apontam. Sem ela, o dono era o único membro que não tinha como sair do próprio espaço.
//
//  Só o dono (assertRole owner), como o convite, a troca de papel e a remoção: transferir é a
//  decisão mais forte que existe aqui, e quem a toma é quem a perde.
//
//  TRÊS ESCRITAS, UMA TRANSACTION. Fora de uma transaction, uma falha entre elas deixa o espaço
//  com dois donos ou com nenhum — e nenhum desses dois estados tem rota que conserte, porque
//  toda rota de gestão exige justamente um dono para ser chamada.
//
//  As duas primeiras são os papéis das matrículas, que é o que o assertRole lê. A terceira é o
//  Workspaces.IdOwnerUser, e ela é obrigatória pelo mesmo motivo: a propriedade está gravada em
//  DOIS lugares, e nenhum deles é derivado do outro. Nenhuma rota autoriza pelo IdOwnerUser —
//  esse é sempre o papel da matrícula —, mas é ele que sai no GET /Workspaces/getSelf, e é dele
//  que o cliente tira "sou o dono deste espaço" para decidir o que oferecer na tela. Mover um
//  sem o outro deixa a tela e a API discordando sobre quem manda: o cliente ofereceria o
//  convite a quem levaria 403, e o esconderia de quem tem direito a ele.
export class TransferOwnership {
    public async run(SelectedIdWorkspace: number | undefined, IdWorkspaceMember: number, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        //  O IdWorkspace entra junto na busca: o id da matrícula chega do cliente e é
        //  sequencial, então uma matrícula conferida no próprio tenant deixaria entregar o
        //  espaço do vizinho a alguém. 406 "não encontrado", como em toda leitura escopada —
        //  um 404 confirmaria que a matrícula existe em algum lugar.
        let target = await WorkspaceMembers_model.getUnique(membership.IdWorkspace, IdWorkspaceMember)

        if (!target) {
            throw new APIError({
                msg: "Membro não encontrado!",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        //  Transferir para si mesmo passaria pelas três escritas e gravaria o MESMO estado com
        //  outro nome: quem chamou viraria 'editor' e 'owner' na mesma transaction, na ordem em
        //  que as queries caíssem. A comparação é entre matrículas, que é o que a rota endereça.
        if (target.IdWorkspaceMember === membership.IdWorkspaceMember) {
            throw new APIError({
                msg: "Você já é o dono deste espaço. Escolha outro membro para receber a propriedade.",
                status: 406,
                data: { IdWorkspaceMember, IdUser },
            })
        }

        await KnexTransaction(async (tx) => {
            //  O alvo vira dono, qualquer que fosse o papel dele: um viewer que recebe o espaço
            //  recebe também o que o papel dá, porque não existe dono que só consulta.
            await WorkspaceMembers_model.update(target!.IdWorkspaceMember, { Role: "owner" }).transacting(tx)

            //  E quem entregou vira EDITOR, não viewer: quem passa a chave não deveria perder o
            //  acesso de escrita no mesmo clique. Rebaixar mais é decisão do novo dono, que
            //  agora pode tomá-la pelo PUT /Workspaces/members/IdWorkspaceMember=:Id.
            await WorkspaceMembers_model.update(membership.IdWorkspaceMember, { Role: "editor" }).transacting(tx)

            await Workspaces_model.update(membership.IdWorkspace, { IdOwnerUser: target!.IdUser }).transacting(tx)
        })

        return { msg: "Propriedade transferida com sucesso" }
    }
}
