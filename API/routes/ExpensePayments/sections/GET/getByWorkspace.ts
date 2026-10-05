import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ExpensePersons_model } from "root/routes/Expenses/ExpensePersons.model"
import { Expenses_model } from "root/routes/Expenses/Expenses.model"
import { Tags_model } from "root/routes/Tags/Tags.model"
import { Database } from "root/Utils/database"
import { ExpensePayments_model } from "../../ExpensePayments.model"
import { ExpensePaymentsNamespace } from "../types"

//  **A lista do que cai no mês** — a perna, com o gasto de onde ela saiu e o rateio dele.
//
//  É a outra metade de GET /Expenses, não uma versão dela: aquela é a lista de **compras**
//  (filtrada por ExpenseDate), esta é a lista do que **sai** (filtrada por
//  coalesce(DueDate, ExpenseDate)). Uma compra parcelada em março não aparece na lista de
//  agosto, mas a 6ª parcela dela pesa em agosto — e é aqui que ela aparece.
//
//  A perna é a unidade que todo total do sistema já usa: é assim que o BudgetSpent conta
//  ("600 em 6x custa 100 ao mês") e é assim que o AccountBalance desconta.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number, filters: ExpensePaymentsNamespace.ListFilters) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let payments = await ExpensePayments_model.getByPeriod(IdWorkspace, filters)

        if (!payments.length) return []

        //  Os ids únicos: as seis parcelas de uma compra apontam para o mesmo gasto, e buscar
        //  o gasto uma vez por perna seria reabrir o N+1 que esta rota existe para fechar.
        let ids = [...new Set(payments.map((payment) => payment.IdExpense))]

        //  Três consultas para a lista inteira, como no GET /Budgets. O IncludeCanceled aqui é
        //  sempre true de propósito: quem já decidiu se o cancelado entra foi a consulta das
        //  pernas — repetir o filtro aqui deixaria a perna sem o gasto dela quando o cliente
        //  pedisse os cancelados.
        let [expenses, persons, tags] = await Promise.all([
            Expenses_model.getByWorkspace(IdWorkspace, { IncludeCanceled: true }).whereIn("IdExpense", ids),
            ExpensePersons_model.getByExpenses(ids),
            //  A terceira é a das tags, e ela entrou pelo mesmo argumento das outras duas: a
            //  etiqueta só voltava no GET de um gasto só, então mostrá-la na listagem custava
            //  um get(id) por gasto do período — o N+1 que esta rota fechou.
            Tags_model.getByExpenses(ids),
        ])

        let expenseById = new Map(expenses.map((expense) => [expense.IdExpense, expense]))

        let personsByExpense = new Map<number, typeof persons>()

        for (let person of persons) {
            personsByExpense.set(person.IdExpense, [...(personsByExpense.get(person.IdExpense) ?? []), person])
        }

        //  O IdExpense é descartado no agrupamento: ele é a chave do vínculo, e o que sai na
        //  resposta é **a tag inteira**, igual à do GET de um gasto só.
        let tagsByExpense = new Map<number, Database.Tags[]>()

        for (let { IdExpense, ...tag } of tags) {
            tagsByExpense.set(IdExpense, [...(tagsByExpense.get(IdExpense) ?? []), tag])
        }

        return payments.map((payment) => ({
            ...payment,
            Expense: expenseById.get(payment.IdExpense)!,
            //  **O rateio é o do GASTO, não o da perna.** Numa compra em 6x as seis pernas
            //  trazem o mesmo rateio de 600 — somar pessoa a pessoa, perna a perna, dá 3600.
            //  Quem quiser "quanto é da Maria neste mês" tem que ratear a perna pela proporção
            //  do gasto. Nada estoura se ninguém fizer isso: o número só fica errado.
            Persons: personsByExpense.get(payment.IdExpense) ?? [],
            //  **A tag é do gasto e pronto** — e é aí que ela difere de Persons: o rateio tem
            //  valor, então a perna precisa rateá-lo para virar número; a tag não tem valor
            //  nenhum, então as seis parcelas repetem a mesma etiqueta e não há nada a errar.
            Tags: tagsByExpense.get(payment.IdExpense) ?? [],
        }))
    }
}
