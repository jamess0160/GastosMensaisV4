import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Utils } from "root/Utils/Utils"

//  **Quanto já foi comprometido no mês**, por categoria e por pessoa. É o número que dá sentido
//  ao teto: um orçamento sem o gasto ao lado é só um número guardado.
//
//  Três decisões moram aqui, e todas as três mudam o resultado:
//
//  1. **Conta a perna, não o gasto.** A compra de 600 em 6x não come 600 do orçamento de
//     agosto: come 100 em cada um dos seis meses, que é como o dinheiro realmente sai e como
//     a pessoa orça ("a parcela do notebook pesa 100 por mês"). Somar `Expenses.TotalValue` na
//     data da compra estouraria o teto de agosto por uma dívida que é de meio ano.
//  2. **A data que vale é a da saída:** a `CompetenceDate` da perna, congelada no lançamento —
//     o vencimento quando existe (parcela, e a fatura do cartão), senão a data do gasto, já que
//     pix e débito à vista saem no ato e não têm vencimento.
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
            .where("ExpensePayments.CompetenceDate", ">=", ReferenceMonth)
            .where("ExpensePayments.CompetenceDate", "<", nextMonth)
            .groupBy("Expenses.IdCategory") as Array<{ IdCategory: number, Total: number }>

        for (let row of rows) {
            spent.set(row.IdCategory, Number(row.Total))
        }

        return spent
    }

    //  **O comprometido de uma pessoa: o eixo analítico (ExpensePersons), não o financeiro.**
    //
    //  As três regras acima valem iguais — cancelado fora, coalesce(DueDate, ExpenseDate)
    //  dentro do mês, pendente contando junto com pago. O que muda é uma multiplicação:
    //
    //      ExpensePersons.Value * ExpensePayments.Value / Expenses.TotalValue
    //
    //  **O rateio é do gasto e a parcela é da perna**, então o comprometido da pessoa no mês é
    //  a parte dela *daquela parcela*. 600 em 6x todos da Maria dão **100 por mês** no
    //  orçamento dela — o mesmo número que a categoria enxerga. Sem o rateio, o mesmo gasto
    //  contaria 600 num orçamento e 100 no outro, e "quanto a Maria comprometeu em agosto" não
    //  teria resposta certa.
    //
    //  **O join de ExpensePersons multiplica as linhas de propósito:** a consulta passa a ter
    //  um par (perna x pessoa) por linha, e é sobre esse par que o rateio acontece. Quem
    //  "otimizar" somando antes e rateando depois muda a conta.
    //
    //  E arredonda **uma vez, no fim**: a divisão em numeric do Postgres tem precisão de sobra,
    //  e arredondar por parcela espalharia o erro.
    public async getByPersons(IdWorkspace: number, ReferenceMonth: string, persons: number[]) {
        let spent = new Map<number, number>()

        if (!persons.length) return spent

        let nextMonth = Utils.addMonthsToDate(ReferenceMonth, 1)

        let rows = await KnexConnection
            .select("ExpensePersons.IdPerson")
            .select(KnexConnection.raw('round(sum("ExpensePersons"."Value" * "ExpensePayments"."Value" / "Expenses"."TotalValue"), 2) as "Total"'))
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .innerJoin("ExpensePersons", "ExpensePersons.IdExpense", "Expenses.IdExpense")
            .where("Expenses.IdWorkspace", IdWorkspace)
            .whereIn("ExpensePersons.IdPerson", persons)
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.CompetenceDate", ">=", ReferenceMonth)
            .where("ExpensePayments.CompetenceDate", "<", nextMonth)
            .groupBy("ExpensePersons.IdPerson") as Array<{ IdPerson: number, Total: number }>

        for (let row of rows) {
            spent.set(row.IdPerson, Number(row.Total))
        }

        return spent
    }
}

export const BudgetSpent = new Controller()
