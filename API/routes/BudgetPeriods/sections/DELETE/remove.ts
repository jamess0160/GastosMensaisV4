import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { ClosedMonth } from "../ClosedMonth.section"

//  Tira uma fatia do mês.
//
//  **Delete físico, ao contrário de toda tabela de cadastro deste projeto.** A linha é plano,
//  não lançamento: nada aponta para ela, nenhum dinheiro passou por ela, e "não quero orçar
//  mercado em setembro" não é histórico que valha guardar — guardar seria deixar na tela uma
//  fatia que o usuário disse não querer.
//
//  Nada sobrevive a ela: desde a leva 9 não há definição perene por trás, e a fatia é a coisa
//  inteira.
//
//  **Um mês fechado recusa**, pelo mesmo motivo do PUT — e aqui com mais razão, já que o delete
//  é físico e não há `Active` para desfazer depois.
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

        ClosedMonth.assertPeriodOpen(period)

        await BudgetPeriods_model.delete(IdBudgetPeriod)

        return { msg: "Orçamento do mês removido com sucesso" }
    }
}
