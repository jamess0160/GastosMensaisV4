import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Expenses_model } from "../../Expenses.model"
import { ExpensesNamespace } from "../types"

//  A lista do período. Sem pernas, rateio nem tags: quem precisa deles abre o gasto
//  (GET /Base/Expenses/IdExpense=:IdExpense). Uma lista de mês com três filhas por linha seria
//  carregar o que a tela não mostra.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number, filters: ExpensesNamespace.ListFilters) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Expenses_model.getByWorkspace(IdWorkspace, filters)
    }
}
