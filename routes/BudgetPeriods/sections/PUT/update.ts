import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { BudgetPeriodsNamespace } from "../types"

//  Muda o teto **de um mês só**.
//
//  É o que a separação em duas tabelas compra: "em dezembro pode 1.500" não mexe na definição
//  vigente nem em nenhum outro mês. E o contrário também vale — mexer na definição (cadastrando
//  o mês seguinte) não reescreve dezembro.
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

        //  Sem ReferenceMonth e sem categoria no corpo: mudar qualquer um dos dois seria mover
        //  o teto de lugar, e mover é apagar este e cadastrar outro.
        await BudgetPeriods_model.update(IdBudgetPeriod, body)

        return { msg: "Orçamento do mês atualizado com sucesso" }
    }
}
