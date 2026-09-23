import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "root/routes/Categories/Categories.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { BudgetSpent } from "../BudgetSpent.section"
import { Utils } from "root/Utils/Utils"
import { BudgetPeriodsNamespace } from "../types"

//  O orçamento do mês: cada fatia com o alvo dela e **quanto já foi comprometido**, mais o que
//  o mês gastou **fora** de qualquer fatia.
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
//  **A resposta é um envelope, não uma lista**, e é o `Unbudgeted` que obriga: ele é do **mês**,
//  não de linha nenhuma. Ele existe porque o casamento é estrito (ver BudgetSpent.section.ts) —
//  uma porção de gasto consome uma fatia ou nenhuma, e a que não consome nada precisa aparecer
//  em algum lugar, ou a regra vira um sumiço silencioso de dinheiro. Com ele fecha a conta que
//  o usuário confere sozinho: **soma dos `Spent` + `Unbudgeted` = o gasto do mês inteiro**.
//
//  **Não há mais um `Scope` derivado na resposta.** Ele existia para o cliente não deduzir o
//  tipo pelo id nulo, e funcionava enquanto os formatos eram dois. Com três — só categoria, só
//  pessoa, e as duas juntas — um discriminador de dois valores mentiria, e o que a tela lê é
//  simplesmente o par que veio preenchido.
export class GetByMonth {
    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth: string): Promise<BudgetPeriodsNamespace.MonthPayload> {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let month = Utils.monthStart(ReferenceMonth)

        let periods = await BudgetPeriods_model.getByMonth(IdWorkspace, month)

        //  Consultas para a lista inteira, não por linha: o alvo agora está na própria linha,
        //  então nem a busca das definições existe mais.
        let categoryIds = periods.flatMap((period) => period.IdCategory ? [period.IdCategory] : [])
        let personIds = periods.flatMap((period) => period.IdPerson ? [period.IdPerson] : [])

        //  **Três consultas para o mês inteiro, e nenhuma delas por linha.** A das porções não
        //  depende das fatias — ela é o gasto do mês repartido por (categoria, pessoa) —, e é
        //  por isso que ela cabe aqui dentro do Promise.all: quem cruza as duas coisas é o
        //  `match`, em memória, depois.
        //
        //  **Um mês sem fatia nenhuma não devolve cedo.** O `Unbudgeted` de um mês que ninguém
        //  orçou é o gasto inteiro dele, e essa é a resposta certa — não zero.
        let [categories, persons, portions] = await Promise.all([
            Categories_model.getByWorkspace(IdWorkspace).whereIn("IdCategory", categoryIds),
            Persons_model.getByWorkspace(IdWorkspace).whereIn("IdPerson", personIds),
            BudgetSpent.getPortions(IdWorkspace, month),
        ])

        let categoryById = new Map(categories.map((category) => [category.IdCategory, category]))
        let personById = new Map(persons.map((person) => [person.IdPerson, person]))

        let visible = periods
            .flatMap((period) => {
                //  O alvo pode ter sido arquivado depois de orçado: aí a fatia não tem mais o
                //  que mostrar e sai da tela em vez de aparecer sem nome. A linha continua no
                //  banco — é histórico do mês, e arquivar não é apagar.
                let category = period.IdCategory ? categoryById.get(period.IdCategory) : null
                let person = period.IdPerson ? personById.get(period.IdPerson) : null

                if (period.IdCategory && !category) return []
                if (period.IdPerson && !person) return []

                return [{ ...period, Category: category ?? null, Person: person ?? null }]
            })

        //  **O casamento roda contra as fatias que a resposta mostra**, não contra as que estão
        //  no banco: o que a fatia de alvo arquivado consumiria volta a procurar fatia como
        //  qualquer outra porção, e termina no `Unbudgeted` se não achar nenhuma. É o que faz a
        //  soma da tela fechar com o gasto do mês sem um sumidouro invisível no meio.
        let { ByPeriod, Unbudgeted } = BudgetSpent.match(visible, portions)

        return {
            Periods: visible.map<BudgetPeriodsNamespace.MonthRow>((period) => ({
                ...period,
                Spent: ByPeriod.get(period.IdBudgetPeriod) ?? 0,
            })),
            Unbudgeted,
        }
    }
}
