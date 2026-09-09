import { Database } from "root/Utils/database"
import { APIError } from "root/Utils/Logs"
import { Expenses_model } from "../Expenses.model"

//  A série de um gasto fixo, resolvida a partir de **qualquer** ocorrência dela.
//
//  A série é uma corrente de gastos reais: a raiz tem IdParentExpense nulo e carrega a
//  recorrência, as outras apontam para ela. Não há molde — por isso a raiz também é uma
//  ocorrência de verdade, e por isso editar "a série" precisa primeiro achar a raiz a partir da
//  linha que o cliente abriu.
//
//  **"Daqui para a frente" é o corte, e ele é a data da ocorrência escolhida — não o relógio.**
//  É como um calendário trata "este e os seguintes": determinístico, sem depender de fuso nem
//  do instante em que a requisição chegou, e é o que faz "ocorrência passada guarda o valor que
//  realmente valeu" ser uma frase verificável em teste.
class Controller {

    public async resolve(IdWorkspace: number, IdExpense: number) {
        let expense = await Expenses_model.getUnique(IdWorkspace, IdExpense)

        if (!expense) {
            throw new APIError({
                msg: "Gasto não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpense },
            })
        }

        if (expense.Kind !== "fixed") {
            throw new APIError({
                msg: "Este gasto não faz parte de uma série: só gasto fixo tem série.",
                status: 406,
                data: { IdExpense, Kind: expense.Kind },
            })
        }

        let IdRootExpense = expense.IdParentExpense ?? expense.IdExpense

        let series = await Expenses_model.getSeries(IdWorkspace, IdRootExpense)

        return {
            expense,
            IdRootExpense,
            /** A ocorrência escolhida e todas as seguintes, que são as que a edição alcança. */
            forward: this.forwardFrom(series, expense),
            /** As anteriores, que ficam como estão: elas já valeram. */
            past: series.filter((item) => item.ExpenseDate < expense.ExpenseDate),
        }
    }

    private forwardFrom(series: Database.Expenses[], from: Database.Expenses) {
        return series
            .filter((item) => item.ExpenseDate >= from.ExpenseDate)
            //  Cancelada já saiu de cena: reescrever o valor dela seria mexer no que ninguém
            //  vai pagar.
            .filter((item) => item.Status !== "canceled")
    }
}

export const ExpenseSeries = new Controller()
