import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Workspaces_model extends BaseModel {

    //  Workspaces não tem Active: o ciclo de vida dele é o do dono (FK com ON DELETE CASCADE).
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Workspaces>("Workspaces").orderBy("IdWorkspace")

    getUnique(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).first()
    }

    //  Quem enxerga o workspace é WorkspaceMembers, não IdOwnerUser: o dono também tem linha
    //  lá, então esta única query já cobre o workspace próprio e os que forem compartilhados.
    getByMember(IdUser: number) {
        return this.baseQuery.clone().whereIn(
            "IdWorkspace",
            this.KnexConnection.select("IdWorkspace").from("WorkspaceMembers").where("IdUser", IdUser)
        )
    }

    //  Todos os workspaces, sem filtro nenhum: é a leitura das **rotinas**, que rodam como o
    //  sistema e iteram os tenants elas mesmas. Nenhuma rota chama isto — numa rota o escopo
    //  vem sempre do token, pelo getByMember.
    getAll() {
        return this.baseQuery.clone()
    }

    create(records: MaybeArray<Partial<Database.Workspaces>>) {
        return this.KnexConnection.insert(records).into("Workspaces")
    }

    update(IdWorkspace: number, record: Partial<Database.Workspaces>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Workspaces").where("IdWorkspace", IdWorkspace)
    }
}

export const Workspaces_model = new class_Workspaces_model()
