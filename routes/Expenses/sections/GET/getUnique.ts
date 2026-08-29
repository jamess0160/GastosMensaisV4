import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { APIError } from "root/Utils/Logs"
import { Tags_model } from "root/routes/Tags/Tags.model"
import { ExpensePersons_model } from "../../ExpensePersons.model"
import { Expenses_model } from "../../Expenses.model"

//  O gasto com os dois eixos e as tags. Os eixos saem em listas separadas — e é assim que a
//  resposta ensina o modelo: Payments é por onde o dinheiro sai, Persons é de quem é o custo, e
//  os dois somam o mesmo total sem terem nada a ver um com o outro.
export class GetUnique {
    public async run(SelectedIdWorkspace: number, IdExpense: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let expense = await Expenses_model.getUnique(IdWorkspace, IdExpense)

        if (!expense) {
            throw new APIError({
                msg: "Gasto não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpense },
            })
        }

        let [Payments, Persons, Tags] = await Promise.all([
            ExpensePayments_model.getByExpense(IdExpense),
            ExpensePersons_model.getByExpense(IdExpense),
            //  As tags inteiras, não as linhas de vínculo: é o nome que a tela mostra, e não
            //  há rota que receba um IdExpenseTag de volta.
            Tags_model.getByExpense(IdExpense),
        ])

        return { ...expense, Payments, Persons, Tags }
    }
}
