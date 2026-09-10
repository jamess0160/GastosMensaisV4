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

    //  Os espaços de que este usuário é o dono E que têm outro membro além dele.
    //
    //  É a leitura que autoriza o DELETE /Users, e por isso ela filtra por IdOwnerUser e não
    //  pelo papel da matrícula: quem cascateia o workspace inteiro quando a linha de Users
    //  some é a FK Workspaces.IdOwnerUser, então a guarda tem que perguntar exatamente pela
    //  coluna que dispara a cascata. As duas respondem igual — transferOwnership move as duas
    //  na mesma transaction —, mas só uma delas é a que o banco vai obedecer.
    //
    //  Vazio significa "pode apagar": ou a pessoa não é dona de nada, ou os espaços que ela
    //  tem são só dela, e aí a cascata leva embora apenas o que era dela mesma.
    getOwnedWithOtherMembers(IdUser: number) {
        return this.baseQuery.clone()
            .where("IdOwnerUser", IdUser)
            .whereExists((query) => {
                query.select("*")
                    .from("WorkspaceMembers")
                    .whereRaw('"WorkspaceMembers"."IdWorkspace" = "Workspaces"."IdWorkspace"')
                    .whereNot("WorkspaceMembers.IdUser", IdUser)
            })
    }

    create(records: MaybeArray<Partial<Database.Workspaces>>) {
        return this.KnexConnection.insert(records).into("Workspaces")
    }

    update(IdWorkspace: number, record: Partial<Database.Workspaces>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Workspaces").where("IdWorkspace", IdWorkspace)
    }
}

export const Workspaces_model = new class_Workspaces_model()
