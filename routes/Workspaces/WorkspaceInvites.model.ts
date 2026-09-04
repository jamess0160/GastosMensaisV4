import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  O convite para entrar no workspace. Terceiro model desta pasta, pelo mesmo motivo do
//  WorkspaceMembers: a tabela não tem rota própria — todas as rotas dela são `/Workspaces/...`,
//  então não haveria o que colocar num route/controller/schema separados.
//
//  Sem Active: o ciclo de vida é o Status (pending → accepted | revoked), como em Inflows e
//  Expenses. Por isso nenhuma query aqui filtra Active, e nenhum delete é físico ou soft: o
//  que existe é a revogação, que é uma troca de Status.
export class class_WorkspaceInvites_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.WorkspaceInvites>("WorkspaceInvites").orderBy("IdWorkspaceInvite", "desc")

    //  A leitura pública da tela de aceite. Sem filtro de Status de propósito: quem decide o
    //  que fazer com um convite revogado ou expirado é a section, que tem uma msg para cada
    //  caso — filtrar aqui devolveria "não encontrado" para os três.
    getByHash(Hash: string) {
        return this.baseQuery.clone().where("Hash", Hash).first()
    }

    //  "Quem eu convidei e ainda não entrou": é a listagem do dono.
    getPendingByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("Status", "pending")
    }

    //  Convite repetido para o mesmo e-mail renova o existente em vez de criar um segundo.
    //  Dois links vivos para o mesmo convite é o pior caso possível: revogar um deixaria o
    //  outro funcionando.
    getPendingByEmail(IdWorkspace: number, Email: string) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("Email", Email).where("Status", "pending").first()
    }

    //  O IdWorkspace entra junto com o id da linha pelo mesmo motivo do Accounts.getUnique: o
    //  id chega do cliente e é sequencial.
    getUnique(IdWorkspace: number, IdWorkspaceInvite: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdWorkspaceInvite", IdWorkspaceInvite).first()
    }

    create(records: MaybeArray<Partial<Database.WorkspaceInvites>>) {
        return this.KnexConnection.insert(records).into("WorkspaceInvites")
    }

    update(IdWorkspaceInvite: number, record: Partial<Database.WorkspaceInvites>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("WorkspaceInvites").where("IdWorkspaceInvite", IdWorkspaceInvite)
    }
}

export const WorkspaceInvites_model = new class_WorkspaceInvites_model()
