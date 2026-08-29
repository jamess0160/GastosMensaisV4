import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

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

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.ExpensePayments>("ExpensePayments").orderBy("InstallmentNumber").orderBy("IdExpensePayment")

    getByExpense(IdExpense: number) {
        return this.baseQuery.clone().where("IdExpense", IdExpense)
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
