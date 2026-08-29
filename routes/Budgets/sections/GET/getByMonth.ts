import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { BudgetPeriods_model } from "root/routes/BudgetPeriods/BudgetPeriods.model"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Budgets_model } from "../../Budgets.model"
import { BudgetSpent } from "../BudgetSpent.section"
import { Utils } from "root/Utils/Utils"

//  O orçamento do mês: cada teto com a categoria dele e **quanto já foi comprometido**.
//
//  O gasto vem junto porque teto sem gasto ao lado é um número guardado — a tela existe para
//  responder "quanto ainda posso gastar em mercado", e isso é uma subtração. O alerta fica com
//  o cliente: a resposta devolve `LimitValue`, `Spent` e `AlertPercent`, e comparar os três é
//  trabalho de quem desenha a barra.
export class GetByMonth {
    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let month = Utils.monthStart(ReferenceMonth)

        let periods = await BudgetPeriods_model.getByMonth(IdWorkspace, month)

        if (!periods.length) return []

        //  Duas consultas para a lista inteira, não duas por linha: a definição diz de qual
        //  categoria é o teto, e a categoria dá o nome que a tela mostra.
        let budgets = await Budgets_model.getByWorkspace(IdWorkspace).whereIn("IdBudget", periods.map((period) => period.IdBudget))

        let byId = new Map(budgets.map((budget) => [budget.IdBudget, budget]))

        let categories = await Categories_model.getByWorkspace(IdWorkspace).whereIn("IdCategory", budgets.map((budget) => budget.IdCategory))

        let categoryById = new Map(categories.map((category) => [category.IdCategory, category]))

        //  Uma consulta agrupada para o mês inteiro — ver BudgetSpent.section.ts.
        let spent = await BudgetSpent.getByCategories(IdWorkspace, month, budgets.map((budget) => budget.IdCategory))

        return periods
            //  Um período órfão não existe hoje (o IdBudget é NOT NULL e a FK é CASCADE), mas
            //  a categoria pode ter sido arquivada depois de orçada: aí o teto não tem mais o
            //  que mostrar e sai da tela em vez de aparecer sem nome.
            .filter((period) => categoryById.has(byId.get(period.IdBudget)?.IdCategory!))
            .map((period) => {
                let budget = byId.get(period.IdBudget)!

                return {
                    ...period,
                    IdCategory: budget.IdCategory,
                    Category: categoryById.get(budget.IdCategory)!,
                    Spent: spent.get(budget.IdCategory) ?? 0,
                }
            })
    }
}
