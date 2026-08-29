import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"
import { ExpensesNamespace } from "./sections/types"

//  O gasto. Substitui baseexpenses + defaultexpenses + fixedexpenses + installmentexpenses do
//  V3: os três formatos (à vista, parcelado, fixo) são a mesma linha com Kind diferente.
//
//  **Status é derivado das pernas de ExpensePayments e nunca é editado direto** — 'paid' só
//  quando todas estão pagas. Quem o escreve é o ExpenseStatus.section, e o schema do PUT não
//  aceita Status no corpo. Não existe estado parcial no gasto: as pernas é que sabem o que já
//  foi quitado.
//
//  Sem Active nesta tabela: o ciclo de vida é o Status, e cancelar é Status='canceled'.
export class class_Expenses_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Expenses>("Expenses").orderBy("ExpenseDate").orderBy("IdExpense")

    //  O período (From/To) é o mesmo formato de Inflows — ver Utils/joiSchemas.ts. Sem Status
    //  no filtro, o cancelado fica de fora: ele é lixo, não histórico.
    getByWorkspace(IdWorkspace: number, filters: ExpensesNamespace.ListFilters = {}) {
        let query = this.baseQuery.clone().where("IdWorkspace", IdWorkspace)

        if (filters.From) query = query.where("ExpenseDate", ">=", filters.From)
        if (filters.To) query = query.where("ExpenseDate", "<=", filters.To)
        if (filters.IdCategory) query = query.where("IdCategory", filters.IdCategory)
        if (filters.Kind) query = query.where("Kind", filters.Kind)

        return filters.Status ? query.where("Status", filters.Status) : query.whereNot("Status", "canceled")
    }

    getUnique(IdWorkspace: number, IdExpense: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdExpense", IdExpense).first()
    }

    //  A série inteira de um gasto fixo: a raiz e as ocorrências que apontam para ela. Editar
    //  ou encerrar a série mexe em várias linhas de uma vez.
    getSeries(IdWorkspace: number, IdRootExpense: number) {
        return this.baseQuery.clone()
            .where("IdWorkspace", IdWorkspace)
            .where((query) => query.where("IdExpense", IdRootExpense).orWhere("IdParentExpense", IdRootExpense))
    }

    create(records: MaybeArray<Partial<Database.Expenses>>) {
        return this.KnexConnection.insert(records).into("Expenses")
    }

    update(IdExpense: number, record: Partial<Database.Expenses>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Expenses").where("IdExpense", IdExpense)
    }

    updateMany(ids: number[], record: Partial<Database.Expenses>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Expenses").whereIn("IdExpense", ids)
    }
}

export const Expenses_model = new class_Expenses_model()
