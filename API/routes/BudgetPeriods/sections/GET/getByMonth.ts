import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { BudgetSpent } from "../BudgetSpent.section"
import { Utils } from "root/Utils/Utils"
import { BudgetPeriodsNamespace } from "../types"

//  O orçamento do mês: cada fatia com o alvo dela e **quanto já foi comprometido**.
//
//  **Qualquer mês responde** — passado, corrente ou futuro. Nada aqui nasce de rotina desde a
//  leva 9: um mês tem orçamento porque alguém o montou, então navegar para outubro em setembro
//  devolve o que já foi montado para outubro, e montar outubro em setembro é só um POST.
//
//  O gasto vem junto porque valor sem gasto ao lado é um número guardado — a tela existe para
//  responder "quanto ainda posso gastar em mercado", e isso é uma subtração. O alerta fica com
//  o cliente: a resposta devolve `LimitValue`, `Spent` e `AlertPercent`, e comparar os três é
//  trabalho de quem desenha a barra.
//
//  **Não há mais um `Scope` derivado na resposta.** Ele existia para o cliente não deduzir o
//  tipo pelo id nulo, e funcionava enquanto os formatos eram dois. Com três — só categoria, só
//  pessoa, e as duas juntas — um discriminador de dois valores mentiria, e o que a tela lê é
//  simplesmente o par que veio preenchido.
export class GetByMonth {
    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let month = Utils.monthStart(ReferenceMonth)

        let periods = await BudgetPeriods_model.getByMonth(IdWorkspace, month)

        if (!periods.length) return []

        //  Consultas para a lista inteira, não por linha: o alvo agora está na própria linha,
        //  então nem a busca das definições existe mais.
        let categoryIds = periods.flatMap((period) => period.IdCategory ? [period.IdCategory] : [])
        let personIds = periods.flatMap((period) => period.IdPerson ? [period.IdPerson] : [])

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
            .flatMap<BudgetPeriodsNamespace.MonthRow>((period) => {
                //  O alvo pode ter sido arquivado depois de orçado: aí a fatia não tem mais o
                //  que mostrar e sai da tela em vez de aparecer sem nome. A linha continua no
                //  banco — é histórico do mês, e arquivar não é apagar.
                let category = period.IdCategory ? categoryById.get(period.IdCategory) : null
                let person = period.IdPerson ? personById.get(period.IdPerson) : null

                if (period.IdCategory && !category) return []
                if (period.IdPerson && !person) return []

                return [{
                    ...period,
                    Category: category ?? null,
                    Person: person ?? null,
                    //  **O comprometido da linha de alvo duplo ainda é o da pessoa inteira**, e
                    //  não a parte dela naquela categoria. É o mínimo que faz a rota responder
                    //  com o alvo novo; casar a porção do gasto com a linha de orçamento é a
                    //  etapa 10, e antecipá-la aqui seria escrever duas vezes a mesma regra.
                    Spent: period.IdPerson
                        ? personSpent.get(period.IdPerson) ?? 0
                        : categorySpent.get(period.IdCategory!) ?? 0,
                }]
            })
    }
}
