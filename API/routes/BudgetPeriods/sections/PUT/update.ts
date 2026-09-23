import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { ClosedMonth } from "../ClosedMonth.section"
import { BudgetPeriodsNamespace } from "../types"

//  Muda o valor **de uma fatia só**.
//
//  Cada linha é uma fatia independente da renda daquele mês, então corrigir "Mercado: 500" não
//  toca em "Luana: 250" nem em mês nenhum — e não existe mais uma definição perene atrás dela
//  para o ajuste vazar para o futuro.
//
//  **Um mês fechado recusa.** Ver ClosedMonth.section.ts: o `ClosedAt` que a rotina carimba é a
//  única coisa que ainda separa o mês que está sendo montado do que já passou.
export class Update {
    public async run(SelectedIdWorkspace: number, IdBudgetPeriod: number, IdUser: number, body: BudgetPeriodsNamespace.UpdateBudgetPeriodPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let period = await BudgetPeriods_model.getUnique(IdWorkspace, IdBudgetPeriod)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdBudgetPeriod existem nos outros tenants.
        if (!period) {
            throw new APIError({
                msg: "Orçamento do mês não encontrado!",
                status: 406,
                data: { IdWorkspace, IdBudgetPeriod },
            })
        }

        ClosedMonth.assertPeriodOpen(period)

        //  Sem ReferenceMonth e sem alvo no corpo: mudar qualquer um dos dois seria mover a
        //  fatia de lugar, e mover é apagar esta e cadastrar outra.
        await BudgetPeriods_model.update(IdBudgetPeriod, body)

        return { msg: "Orçamento do mês atualizado com sucesso" }
    }
}
