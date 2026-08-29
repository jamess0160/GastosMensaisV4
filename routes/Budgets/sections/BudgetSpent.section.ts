import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Utils } from "root/Utils/Utils"

//  **Quanto já foi comprometido no mês, por categoria.** É o número que dá sentido ao teto: um
//  orçamento sem o gasto ao lado é só um número guardado.
//
//  Três decisões moram aqui, e todas as três mudam o resultado:
//
//  1. **Conta a perna, não o gasto.** A compra de 600 em 6x não come 600 do orçamento de
//     agosto: come 100 em cada um dos seis meses, que é como o dinheiro realmente sai e como
//     a pessoa orça ("a parcela do notebook pesa 100 por mês"). Somar `Expenses.TotalValue` na
//     data da compra estouraria o teto de agosto por uma dívida que é de meio ano.
//  2. **A data que vale é a da saída:** `DueDate` quando existe (parcela, e a fatura do cartão),
//     senão a data do gasto — pix e débito à vista saem no ato e não têm vencimento.
//  3. **Conta pago e pendente, ao contrário do saldo.** Saldo é realizado; orçamento é
//     comprometido. O gasto lançado e ainda não quitado já consumiu o teto do mês — é
//     exatamente o que a pessoa precisa ver antes de gastar de novo. Só o cancelado sai.
class Controller {

    public async getByCategories(IdWorkspace: number, ReferenceMonth: string, categories: number[]) {
        let spent = new Map<number, number>()

        if (!categories.length) return spent

        //  Meio aberto (>= início, < mês seguinte): não precisa saber quantos dias tem o mês, e
        //  não deixa o dia 31 escapar de um `between` mal montado.
        let nextMonth = Utils.addMonthsToDate(ReferenceMonth, 1)

        let rows = await KnexConnection
            .select("Expenses.IdCategory")
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("Expenses.IdWorkspace", IdWorkspace)
            .whereIn("Expenses.IdCategory", categories)
            //  Gasto cancelado não compromete teto nenhum, como não move saldo.
            .whereNot("Expenses.Status", "canceled")
            //  Identificadores entre aspas: o Postgres dobra para minúsculo sem elas.
            .whereRaw('coalesce("ExpensePayments"."DueDate", "Expenses"."ExpenseDate") >= ?', [ReferenceMonth])
            .whereRaw('coalesce("ExpensePayments"."DueDate", "Expenses"."ExpenseDate") < ?', [nextMonth])
            .groupBy("Expenses.IdCategory") as Array<{ IdCategory: number, Total: number }>

        for (let row of rows) {
            spent.set(row.IdCategory, Number(row.Total))
        }

        return spent
    }
}

export const BudgetSpent = new Controller()
