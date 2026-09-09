import { Knex } from "knex"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { CreateForMonth } from "root/routes/BudgetPeriods/sections/POST/createForMonth"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { Utils } from "root/Utils/Utils"
import { class_Budgets_model } from "../../Budgets.model"
import { BudgetTarget } from "../BudgetTarget.section"
import { BudgetsNamespace } from "../types"

//  Orça uma categoria **ou uma pessoa** em um mês. Duas escritas numa transaction só: a
//  **definição** vigente do alvo e o **mês** congelado.
//
//  É o cadastro manual que a rotina mensal vai substituir (etapa 1 da leva 3) — por enquanto o
//  usuário informa o mês, e é por isso que a rota existe assim. O desenho já é o que a rotina
//  vai usar: ela vai ler a definição e criar o período do mês corrente, que é exatamente o
//  segundo passo daqui — e agora serve aos dois tipos de alvo sem uma linha nova, que é o
//  motivo de a pessoa ter entrado nesta tabela em vez de numa PersonBudgets paralela.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetsNamespace.CreateBudgetPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  Exatamente um alvo, e visível a este workspace: os dois ids chegam do cliente e são
        //  sequenciais. Ver BudgetTarget.section.ts.
        let target = await BudgetTarget.assertTarget(IdWorkspace, body)

        //  A coluna guarda o dia 1: é o que faz o unique(IdBudget, ReferenceMonth) valer.
        let ReferenceMonth = Utils.monthStart(body.ReferenceMonth)

        return await KnexTransaction(async (tx) => {
            let IdBudget = await this.resolveBudget(tx, IdWorkspace, IdUser, target, body)

            let IdBudgetPeriod = await new CreateForMonth(tx).run(IdWorkspace, IdBudget, ReferenceMonth, body.LimitValue, body.AlertPercent)

            return { IdBudget, IdBudgetPeriod }
        })
    }

    //  A definição é única por alvo — dois índices parciais, um por coluna —, então o cadastro
    //  do segundo mês reencontra a linha em vez de criar outra. Mesmo formato do "resolve por
    //  nome" das tags.
    //
    //  E ela passa a valer o teto informado agora, porque é isso que ela é: **a definição
    //  vigente**. Os meses já cadastrados não se mexem — eles estão congelados em
    //  BudgetPeriods, que é exatamente o motivo de existirem duas tabelas.
    private async resolveBudget(tx: Knex.Transaction, IdWorkspace: number, IdUser: number, target: BudgetsNamespace.BudgetTargetPayload, body: BudgetsNamespace.CreateBudgetPayload) {
        let Budgets_model = new class_Budgets_model(tx)

        let existing = target.IdCategory
            ? await Budgets_model.getByCategory(IdWorkspace, target.IdCategory)
            : await Budgets_model.getByPerson(IdWorkspace, target.IdPerson!)

        if (existing) {
            await Budgets_model.update(existing.IdBudget, { LimitValue: body.LimitValue, AlertPercent: body.AlertPercent })

            return existing.IdBudget
        }

        //  IdUser é o autor do cadastro; o dono do dado é o workspace. O alvo entra com as duas
        //  colunas, uma delas nula — é o CHECK do banco que fecha a porta do meio.
        return await Budgets_model.create({
            IdWorkspace,
            IdUser,
            IdCategory: target.IdCategory,
            IdPerson: target.IdPerson,
            LimitValue: body.LimitValue,
            AlertPercent: body.AlertPercent,
        }).returnId("IdBudget")
    }
}
