import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"
import { WorkspacesNamespace } from "./sections/types"

//  Tabela irmã de Workspaces: é a matrícula do usuário no tenant e o que toda leitura de
//  domínio vai consultar para decidir se o IdWorkspace pedido é mesmo do usuário do token.
export class class_WorkspaceMembers_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.WorkspaceMembers>("WorkspaceMembers").orderBy("IdWorkspaceMember")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    //  Uma matrícula pelo id, SEMPRE com o IdWorkspace ao lado — a mesma forma do getUnique de
    //  toda outra feature: o id chega do cliente e é sequencial, então filtrar só por ele
    //  deixaria uma sessão mexer na matrícula do vizinho.
    getUnique(IdWorkspace: number, IdWorkspaceMember: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdWorkspaceMember", IdWorkspaceMember).first()
    }

    //  "Quem tem acesso a este espaço", com o nome e o e-mail de cada um — a única leitura
    //  desta tabela que sai para a tela, e por isso a única que precisa do join.
    //
    //  Os dados da pessoa moram em Users, e Users não tem IdWorkspace: é o join que os traz
    //  sem que a section precise de uma segunda consulta por linha.
    //
    //  A ordem é a da matrícula, que é a ordem de entrada: o dono original é o primeiro, e
    //  quem entrou depois vem na sequência em que entrou. Ordenar por papel deixaria a lista
    //  pulando de lugar quando a propriedade é transferida.
    getByWorkspaceWithUser(IdWorkspace: number) {
        return this.KnexConnection
            .select(
                "WorkspaceMembers.IdWorkspaceMember",
                "WorkspaceMembers.IdUser",
                "WorkspaceMembers.Role",
                "WorkspaceMembers.CreatedAt",
                "Users.Name",
                "Users.Email",
            )
            .from<Database.WorkspaceMembers>("WorkspaceMembers")
            .innerJoin("Users", "Users.IdUser", "WorkspaceMembers.IdUser")
            .where("WorkspaceMembers.IdWorkspace", IdWorkspace)
            .orderBy("WorkspaceMembers.IdWorkspaceMember") as unknown as Promise<WorkspacesNamespace.WorkspaceMemberWithUser[]>
    }

    getByUser(IdUser: number) {
        return this.baseQuery.clone().where("IdUser", IdUser)
    }

    getMembership(IdWorkspace: number, IdUser: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdUser", IdUser).first()
    }

    create(records: MaybeArray<Partial<Database.WorkspaceMembers>>) {
        return this.KnexConnection.insert(records).into("WorkspaceMembers")
    }

    update(IdWorkspaceMember: number, record: Partial<Database.WorkspaceMembers>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("WorkspaceMembers").where("IdWorkspaceMember", IdWorkspaceMember)
    }

    //  Sem Active na tabela: sair do workspace é apagar a matrícula mesmo.
    delete(IdWorkspaceMember: number) {
        return this.KnexConnection.delete().from("WorkspaceMembers").where("IdWorkspaceMember", IdWorkspaceMember)
    }
}

export const WorkspaceMembers_model = new class_WorkspaceMembers_model()
