import { Knex } from "knex"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ExpenseCategory } from "root/routes/Expenses/sections/ExpenseCategory.section"
import { CreateForMonth } from "root/routes/BudgetPeriods/sections/POST/createForMonth"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { Utils } from "root/Utils/Utils"
import { class_Budgets_model } from "../../Budgets.model"
import { BudgetsNamespace } from "../types"

//  Orça uma categoria em um mês. Duas escritas numa transaction só: a **definição** vigente da
//  categoria e o **mês** congelado.
//
//  É o cadastro manual que a rotina mensal vai substituir (etapa 8b) — por enquanto o usuário
//  informa o mês, e é por isso que a rota existe assim. O desenho já é o que a rotina vai usar:
//  ela vai ler a definição e criar o período do mês corrente, que é exatamente o segundo passo
//  daqui.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetsNamespace.CreateBudgetPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  A mesma conferência do gasto: a categoria tem que ser visível a este workspace — a
        //  própria ou uma global. O id chega do cliente e é sequencial.
        await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)

        //  A coluna guarda o dia 1: é o que faz o unique(IdBudget, ReferenceMonth) valer.
        let ReferenceMonth = Utils.monthStart(body.ReferenceMonth)

        return await KnexTransaction(async (tx) => {
            let IdBudget = await this.resolveBudget(tx, IdWorkspace, IdUser, body)

            let IdBudgetPeriod = await new CreateForMonth(tx).run(IdWorkspace, IdBudget, ReferenceMonth, body.LimitValue, body.AlertPercent)

            return { IdBudget, IdBudgetPeriod }
        })
    }

    //  A definição é única por categoria (unique(IdWorkspace, IdCategory)), então o cadastro do
    //  segundo mês reencontra a linha em vez de criar outra — mesmo formato do "resolve por
    //  nome" das tags.
    //
    //  E ela passa a valer o teto informado agora, porque é isso que ela é: **a definição
    //  vigente**. Os meses já cadastrados não se mexem — eles estão congelados em
    //  BudgetPeriods, que é exatamente o motivo de existirem duas tabelas.
    private async resolveBudget(tx: Knex.Transaction, IdWorkspace: number, IdUser: number, body: BudgetsNamespace.CreateBudgetPayload) {
        let Budgets_model = new class_Budgets_model(tx)

        let existing = await Budgets_model.getByCategory(IdWorkspace, body.IdCategory)

        if (existing) {
            await Budgets_model.update(existing.IdBudget, { LimitValue: body.LimitValue, AlertPercent: body.AlertPercent })

            return existing.IdBudget
        }

        //  IdUser é o autor do cadastro; o dono do dado é o workspace.
        return await Budgets_model.create({
            IdWorkspace,
            IdUser,
            IdCategory: body.IdCategory,
            LimitValue: body.LimitValue,
            AlertPercent: body.AlertPercent,
        }).returnId("IdBudget")
    }
}
