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

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.ExpensePayments>("ExpensePayments").orderBy("InstallmentNumber").orderBy("IdExpensePayment")

    getByExpense(IdExpense: number) {
        return this.baseQuery.clone().where("IdExpense", IdExpense)
    }

    //  **As pernas que caem num período** — a lista do que *sai* no mês, ao contrário de
    //  GET /Expenses, que é a lista do que foi *comprado*.
    //
    //  A data comparada é a `CompetenceDate` da perna, a mesma do BudgetSpent e do saldo: no
    //  cartão o vencimento da fatura em que ela caiu, fora dele o dia da compra. É ela que faz a
    //  6ª parcela de uma compra de março aparecer em agosto — filtrando por ExpenseDate a
    //  parcela sumiria do mês em que pesa.
    //
    //  O join com Expenses continua obrigatório mesmo depois de a coluna existir: é ele que
    //  deixa excluir o gasto cancelado, que não pesa em mês nenhum.
    getByPeriod(IdWorkspace: number, filters: ExpensePaymentsNamespace.ListFilters = {}) {
        let query = this.KnexConnection
            .select("ExpensePayments.*")
            .from<Database.ExpensePayments>("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .orderBy("ExpensePayments.CompetenceDate")
            .orderBy("ExpensePayments.IdExpensePayment")

        if (filters.From) query = query.where("ExpensePayments.CompetenceDate", ">=", filters.From)
        if (filters.To) query = query.where("ExpensePayments.CompetenceDate", "<=", filters.To)

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

    //  **As pernas de uma fatura.** A fatura já existe nos dados e não é cadastro nenhum: todas
    //  as pernas de um mesmo ciclo compartilham o **mesmo DueDate exato**, porque o InvoiceDates
    //  calcula o vencimento a partir do DueDay do cartão — duas compras do mesmo ciclo caem no
    //  mesmo dia do mesmo mês. Uma fatura é `(IdPaymentMethod, DueDate)`, uma consulta.
    //
    //  O join com Expenses exclui o cancelado: cancelar um gasto já é o estorno dele, e pagar a
    //  fatura não pode tirar da conta o dinheiro de uma compra que não existe mais.
    getByInvoice(IdWorkspace: number, IdPaymentMethod: number, DueDate: string) {
        return this.KnexConnection
            .select("ExpensePayments.*")
            .from<Database.ExpensePayments>("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .where("ExpensePayments.IdPaymentMethod", IdPaymentMethod)
            .where("ExpensePayments.DueDate", DueDate)
            .whereNot("Expenses.Status", "canceled")
            .orderBy("ExpensePayments.IdExpensePayment")
    }

    //  Quitar é por perna: a compra em 6x precisa saber qual parcela já foi paga. Esse detalhe
    //  nunca sobe para o gasto como status parcial — quem o resume é o ExpenseStatus.
    pay(IdExpensePayment: number, Paid: boolean) {
        return this.KnexConnection
            .update({ Paid, PaidAt: Paid ? this.KnexConnection.fn.now() : null, UpdatedAt: this.KnexConnection.fn.now() })
            .from("ExpensePayments")
            .where("IdExpensePayment", IdExpensePayment)
    }

    //  O `pay` em lote, da fatura inteira. Um UPDATE só para as 40 pernas: quarenta chamadas
    //  seriam quarenta janelas em que o saldo estaria meio pago.
    payMany(ids: number[], Paid: boolean) {
        return this.KnexConnection
            .update({ Paid, PaidAt: Paid ? this.KnexConnection.fn.now() : null, UpdatedAt: this.KnexConnection.fn.now() })
            .from("ExpensePayments")
            .whereIn("IdExpensePayment", ids)
    }

    //  "Entrou na fatura" — outro fato, outra coluna. Não move saldo e não alimenta derivado
    //  nenhum: o Status do gasto continua saindo só do Paid.
    charge(IdExpensePayment: number, Charged: boolean) {
        return this.KnexConnection
            .update({ Charged, ChargedAt: Charged ? this.KnexConnection.fn.now() : null, UpdatedAt: this.KnexConnection.fn.now() })
            .from("ExpensePayments")
            .where("IdExpensePayment", IdExpensePayment)
    }

    deleteByExpense(IdExpense: number) {
        return this.KnexConnection.from("ExpensePayments").where("IdExpense", IdExpense).delete()
    }
}

export const ExpensePayments_model = new class_ExpensePayments_model()
