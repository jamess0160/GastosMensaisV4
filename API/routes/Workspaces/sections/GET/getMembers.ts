import { WorkspaceMembers_model } from "../../WorkspaceMembers.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { WorkspacesNamespace } from "../types"

//  "Quem tem acesso a este espaço". A tabela WorkspaceMembers existe desde a leva 2 e todo
//  controle de acesso do projeto a consulta — mas nunca como LISTA, então o dono convidava
//  alguém e nunca mais via o resultado.
//
//  Abre com assertMember, e NÃO com assertRole: quem divide o espaço tem direito de saber com
//  quem divide. Os lançamentos de todo mundo já estão à vista de todos, e esconder a lista só
//  deixaria o editor sem saber a quem pedir uma permissão.
export class GetMembers {
    public async run(SelectedIdWorkspace: number | undefined, IdUser: number) {
        let membership = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let members = await WorkspaceMembers_model.getByWorkspaceWithUser(membership.IdWorkspace)

        //  O IdUser vem da query e morre aqui: ele é global e atravessa tenants, então as
        //  ações que vêm depois (trocar papel, remover, transferir) endereçam a MATRÍCULA,
        //  que já nasce escopada em (IdWorkspace, IdWorkspaceMember) — a mesma proteção que
        //  o getUnique de toda outra feature usa.
        //
        //  IsSelf é a única coisa daqui que não sai da tabela: ele responde "esta linha é a
        //  do usuário DESTA requisição?". A tela precisa saber para não oferecer "remover" no
        //  próprio nome, e comparar e-mail no cliente seria comparar a coisa errada.
        return members.map((member): WorkspacesNamespace.WorkspaceMemberRow => ({
            IdWorkspaceMember: member.IdWorkspaceMember,
            Name: member.Name,
            Email: member.Email,
            Role: member.Role,
            JoinedAt: member.CreatedAt,
            IsSelf: member.IdUser === IdUser,
        }))
    }
}
