import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Tabela irmã de Workspaces: é a matrícula do usuário no tenant e o que toda leitura de
//  domínio vai consultar para decidir se o IdWorkspace pedido é mesmo do usuário do token.
export class class_WorkspaceMembers_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.WorkspaceMembers>("WorkspaceMembers").orderBy("IdWorkspaceMember")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
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
