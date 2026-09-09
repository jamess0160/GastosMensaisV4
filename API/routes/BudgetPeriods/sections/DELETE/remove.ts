import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"

//  Tira o teto daquele mês.
//
//  **Delete físico, ao contrário de toda tabela de cadastro deste projeto.** O período é plano,
//  não lançamento: nada aponta para ele, nenhum dinheiro passou por ele, e "não quero orçar
//  mercado em setembro" não é histórico que valha guardar — guardar seria deixar na tela um
//  teto que o usuário disse não querer.
//
//  A definição em `Budgets` continua: ela é o que a rotina mensal vai ler para materializar os
//  próximos meses, e apagá-la aqui seria decidir por ela.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdBudgetPeriod: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let period = await BudgetPeriods_model.getUnique(IdWorkspace, IdBudgetPeriod)

        if (!period) {
            throw new APIError({
                msg: "Orçamento do mês não encontrado!",
                status: 406,
                data: { IdWorkspace, IdBudgetPeriod },
            })
        }

        await BudgetPeriods_model.delete(IdBudgetPeriod)

        return { msg: "Orçamento do mês removido com sucesso" }
    }
}
