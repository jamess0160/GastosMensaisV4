import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"
import { ExpensePaymentsNamespace } from "./sections/types"

//  **Eixo financeiro: é o que move saldo.** Uma linha por forma de pagamento **e por parcela**.
//
//  Absorve o parcelamento: 600 em 6x são 6 linhas de 100, cada uma com a sua ClosingDate/DueDate
//  avançando mês a mês. É melhor que o CurrentInstallment/MaxInstallment numa linha só do V3
//  porque deixa ver o comprometimento futuro mês a mês.
//
//  Pasta própria porque tem rota própria (o `pay`), pelo mesmo critério que separou
//  PaymentMethods de Accounts. As duas outras filhas do gasto (ExpensePersons e ExpenseTags)
//  não têm rota e por isso ficam como model dentro de routes/Expenses.
export class class_ExpensePayments_model extends BaseModel {

    //  A data em que a perna **pesa**: o vencimento da fatura quando existe, senão o dia do
    //  gasto. Escrita uma vez só porque ela aparece três vezes na mesma consulta (dois filtros
    //  e a ordenação) e as três têm que ser a mesma expressão.
    private static readonly competenceDate = 'coalesce("ExpensePayments"."DueDate", "Expenses"."ExpenseDate")'

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.ExpensePayments>("ExpensePayments").orderBy("InstallmentNumber").orderBy("IdExpensePayment")

    getByExpense(IdExpense: number) {
        return this.baseQuery.clone().where("IdExpense", IdExpense)
    }

    //  **As pernas que caem num período** — a lista do que *sai* no mês, ao contrário de
    //  GET /Expenses, que é a lista do que foi *comprado*.
    //
    //  A data comparada é `coalesce(DueDate, ExpenseDate)`, a mesma do BudgetSpent: no cartão
    //  vale o vencimento da fatura em que a perna caiu, e fora dele o dia da compra, porque pix
    //  e débito não têm fatura. É esse coalesce que faz a 6ª parcela de uma compra de março
    //  aparecer em agosto — filtrando por ExpenseDate ela sumiria do mês em que pesa.
    //
    //  O join com Expenses é obrigatório e não é só pelo coalesce: é ele que deixa excluir o
    //  gasto cancelado, que não pesa em mês nenhum. A ordenação sai pela mesma expressão do
    //  filtro, senão a lista viria na ordem da compra e não na do desembolso.
    getByPeriod(IdWorkspace: number, filters: ExpensePaymentsNamespace.ListFilters = {}) {
        let query = this.KnexConnection
            .select("ExpensePayments.*")
            .from<Database.ExpensePayments>("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .orderByRaw(`${class_ExpensePayments_model.competenceDate} asc`)
            .orderBy("ExpensePayments.IdExpensePayment")

        //  Identificadores entre aspas: o Postgres dobra para minúsculo sem elas.
        if (filters.From) query = query.whereRaw(`${class_ExpensePayments_model.competenceDate} >= ?`, [filters.From])
        if (filters.To) query = query.whereRaw(`${class_ExpensePayments_model.competenceDate} <= ?`, [filters.To])

        //  A mesma regra que GET /Expenses ganhou: as duas listas do mesmo mês não podem
        //  discordar sobre o que contêm.
        return filters.IncludeCanceled ? query : query.whereNot("Expenses.Status", "canceled")
    }

    //  Escopado por workspace pelo mesmo motivo de sempre: o id da perna chega do cliente na
    //  rota de quitar e é sequencial.
    getUnique(IdWorkspace: number, IdExpensePayment: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdExpensePayment", IdExpensePayment).first()
    }

    create(records: MaybeArray<Partial<Database.ExpensePayments>>) {
        return this.KnexConnection.insert(records).into("ExpensePayments")
    }

    update(IdExpensePayment: number, record: Partial<Database.ExpensePayments>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("ExpensePayments").where("IdExpensePayment", IdExpensePayment)
    }

    //  Quitar é por perna: a compra em 6x precisa saber qual parcela já foi paga. Esse detalhe
    //  nunca sobe para o gasto como status parcial — quem o resume é o ExpenseStatus.
    pay(IdExpensePayment: number, Paid: boolean) {
        return this.KnexConnection
            .update({ Paid, PaidAt: Paid ? this.KnexConnection.fn.now() : null, UpdatedAt: this.KnexConnection.fn.now() })
            .from("ExpensePayments")
            .where("IdExpensePayment", IdExpensePayment)
    }

    deleteByExpense(IdExpense: number) {
        return this.KnexConnection.from("ExpensePayments").where("IdExpense", IdExpense).delete()
    }
}

export const ExpensePayments_model = new class_ExpensePayments_model()
