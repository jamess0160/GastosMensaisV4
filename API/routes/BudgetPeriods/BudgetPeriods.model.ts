import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  **O mês congelado:** uma linha por orçamento por mês, com o teto que valeu naquele mês.
//
//  Filha de Budgets e com rota própria (editar e tirar o teto de um mês), então feature própria
//  — o mesmo critério que separou PaymentMethods de Accounts.
//
//  `ReferenceMonth` é `date` e guarda sempre o dia 1: é isso que faz o unique(IdBudget,
//  ReferenceMonth) barrar duas linhas do mesmo mês em vez de deixá-las conviver por causa de um
//  dia diferente.
export class class_BudgetPeriods_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.BudgetPeriods>("BudgetPeriods").orderBy("IdBudgetPeriod")

    //  O orçamento de um mês inteiro, do workspace. É o que a tela do mês lê.
    getByMonth(IdWorkspace: number, ReferenceMonth: string) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("ReferenceMonth", ReferenceMonth)
    }

    //  Escopado por workspace pelo mesmo motivo de sempre: o id chega do cliente e é sequencial.
    getUnique(IdWorkspace: number, IdBudgetPeriod: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdBudgetPeriod", IdBudgetPeriod).first()
    }

    getByBudgetAndMonth(IdBudget: number, ReferenceMonth: string) {
        return this.baseQuery.clone().where("IdBudget", IdBudget).where("ReferenceMonth", ReferenceMonth).first()
    }

    create(records: MaybeArray<Partial<Database.BudgetPeriods>>) {
        return this.KnexConnection.insert(records).into("BudgetPeriods")
    }

    update(IdBudgetPeriod: number, record: Partial<Database.BudgetPeriods>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod)
    }

    //  **Fecha o mês inteiro de um workspace** — escrita exclusiva da rotina do dia 1º, que é
    //  quem sabe que um mês acabou; nenhuma rota fecha período.
    //
    //  O `where Status = 'open'` não é otimização: é ele que faz rodar de novo não reescrever o
    //  ClosedAt de quem já fechou, e é dessa convergência que o catch-up do motor depende.
    closeMonth(IdWorkspace: number, ReferenceMonth: string) {
        return this.KnexConnection
            .update({ Status: "closed", ClosedAt: this.KnexConnection.fn.now(), UpdatedAt: this.KnexConnection.fn.now() })
            .from("BudgetPeriods")
            .where("IdWorkspace", IdWorkspace)
            .where("ReferenceMonth", ReferenceMonth)
            .where("Status", "open")
    }

    //  Delete físico, ao contrário de toda tabela de cadastro: o período é **plano**, não
    //  lançamento. Nada aponta para ele, nenhum dinheiro passou por ele, e "não quero orçar
    //  mercado em setembro" não é histórico que valha guardar. A definição em Budgets fica.
    delete(IdBudgetPeriod: number) {
        return this.KnexConnection.from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod).delete()
    }
}

export const BudgetPeriods_model = new class_BudgetPeriods_model()
