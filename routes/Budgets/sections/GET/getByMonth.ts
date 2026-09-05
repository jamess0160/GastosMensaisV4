import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { BudgetPeriods_model } from "root/routes/BudgetPeriods/BudgetPeriods.model"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { Budgets_model } from "../../Budgets.model"
import { BudgetSpent } from "../BudgetSpent.section"
import { Utils } from "root/Utils/Utils"
import { BudgetsNamespace } from "../types"

//  O orçamento do mês: cada teto com o alvo dele e **quanto já foi comprometido**.
//
//  O gasto vem junto porque teto sem gasto ao lado é um número guardado — a tela existe para
//  responder "quanto ainda posso gastar em mercado", e isso é uma subtração. O alerta fica com
//  o cliente: a resposta devolve `LimitValue`, `Spent` e `AlertPercent`, e comparar os três é
//  trabalho de quem desenha a barra.
//
//  **Os dois tipos de alvo saem na mesma lista**, como `Categories` devolve as globais junto
//  com as próprias, e cada linha traz o `Scope` já derivado — o cliente não deveria ter que
//  deduzir o tipo pelo id que veio nulo. O precedente do campo derivado na resposta é o
//  `Balance` de `GET /Accounts`.
export class GetByMonth {
    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let month = Utils.monthStart(ReferenceMonth)

        let periods = await BudgetPeriods_model.getByMonth(IdWorkspace, month)

        if (!periods.length) return []

        //  Consultas para a lista inteira, não por linha: a definição diz de qual alvo é o
        //  teto, e o alvo dá o nome que a tela mostra.
        let budgets = await Budgets_model.getByWorkspace(IdWorkspace).whereIn("IdBudget", periods.map((period) => period.IdBudget))

        let byId = new Map(budgets.map((budget) => [budget.IdBudget, budget]))

        let categoryIds = budgets.flatMap((budget) => budget.IdCategory ? [budget.IdCategory] : [])
        let personIds = budgets.flatMap((budget) => budget.IdPerson ? [budget.IdPerson] : [])

        //  Quatro consultas para o mês inteiro, e nenhuma delas por linha. As duas de `Spent`
        //  contam de formas diferentes — ver BudgetSpent.section.ts.
        let [categories, persons, categorySpent, personSpent] = await Promise.all([
            Categories_model.getByWorkspace(IdWorkspace).whereIn("IdCategory", categoryIds),
            Persons_model.getByWorkspace(IdWorkspace).whereIn("IdPerson", personIds),
            BudgetSpent.getByCategories(IdWorkspace, month, categoryIds),
            BudgetSpent.getByPersons(IdWorkspace, month, personIds),
        ])

        let categoryById = new Map(categories.map((category) => [category.IdCategory, category]))
        let personById = new Map(persons.map((person) => [person.IdPerson, person]))

        return periods
            .flatMap<BudgetsNamespace.MonthRow>((period) => {
                let budget = byId.get(period.IdBudget)

                //  Um período órfão não existe hoje (o IdBudget é NOT NULL e a FK é CASCADE),
                //  mas o alvo pode ter sido arquivado depois de orçado: aí o teto não tem mais
                //  o que mostrar e sai da tela em vez de aparecer sem nome. A linha continua no
                //  banco — é histórico do mês, e arquivar não é apagar.
                if (!budget) return []

                if (budget.IdCategory) {
                    let category = categoryById.get(budget.IdCategory)

                    if (!category) return []

                    return [{
                        ...period,
                        Scope: "category" as const,
                        IdCategory: budget.IdCategory,
                        Category: category,
                        IdPerson: null,
                        Person: null,
                        Spent: categorySpent.get(budget.IdCategory) ?? 0,
                    }]
                }

                let person = personById.get(budget.IdPerson!)

                if (!person) return []

                return [{
                    ...period,
                    Scope: "person" as const,
                    IdCategory: null,
                    Category: null,
                    IdPerson: budget.IdPerson,
                    Person: person,
                    //  Rateado pelas parcelas: 600 em 6x da Maria dão 100 neste mês, o mesmo
                    //  número que o orçamento da categoria enxerga.
                    Spent: personSpent.get(budget.IdPerson!) ?? 0,
                }]
            })
    }
}
