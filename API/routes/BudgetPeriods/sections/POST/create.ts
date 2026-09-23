import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { BudgetPeriods_model } from "../../BudgetPeriods.model"
import { BudgetTarget } from "../BudgetTarget.section"
import { ClosedMonth } from "../ClosedMonth.section"
import { BudgetPeriodsNamespace } from "../types"

//  Uma fatia da renda de um mês: quanto vai para este alvo, neste mês.
//
//  **Uma escrita só, e nenhuma transaction.** Até a leva 9 eram duas — a definição vigente em
//  `Budgets` e o mês congelado aqui —, e a transaction existia para as duas não se separarem.
//  A definição morreu com o "para sempre" que ela guardava, então sobrou a linha do mês, que é
//  a única coisa que o usuário de fato escreve.
//
//  **Qualquer mês pode ser montado**: passado, corrente ou futuro. Não há rotina materializando
//  nada, então outubro em setembro é só este POST — era exatamente o que o modelo anterior não
//  tinha como oferecer, porque materializar na leitura congelaria o teto de hoje num mês que
//  ainda não chegou.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: BudgetPeriodsNamespace.CreateBudgetPeriodPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  Pelo menos um alvo, e visível a este workspace: os dois ids chegam do cliente e são
        //  sequenciais. Ver BudgetTarget.section.ts.
        let target = await BudgetTarget.assertTarget(IdWorkspace, body)

        //  A coluna guarda o dia 1: é o que faz os três índices parciais valerem.
        let ReferenceMonth = Utils.monthStart(body.ReferenceMonth)

        await ClosedMonth.assertMonthOpen(IdWorkspace, ReferenceMonth)

        //  O índice parcial do formato já barraria, mas com 500. E a resposta importa: o
        //  conserto é editar a fatia que já existe, não cadastrar de novo.
        //
        //  **É o alvo inteiro que se repete, não uma das duas colunas:** "Mercado" e "Maria em
        //  Mercado" são fatias diferentes do mesmo mês e convivem, porque a segunda não é um
        //  teto dentro da primeira — as duas somam lado a lado.
        let existing = await BudgetPeriods_model.getByTarget(IdWorkspace, ReferenceMonth, target.IdCategory, target.IdPerson)

        if (existing) {
            throw new APIError({
                msg: "Este alvo já tem uma linha de orçamento neste mês.",
                status: 406,
                data: { IdBudgetPeriod: existing.IdBudgetPeriod, ReferenceMonth },
            })
        }

        //  Status nasce 'open' e só a rotina o fecha. Sem rota que aceite 'closed', o valor não
        //  tem como divergir do que a virada do mês decidiu.
        let IdBudgetPeriod = await BudgetPeriods_model.create({
            IdWorkspace,
            IdCategory: target.IdCategory,
            IdPerson: target.IdPerson,
            ReferenceMonth,
            LimitValue: body.LimitValue,
            AlertPercent: body.AlertPercent,
        }).returnId("IdBudgetPeriod")

        return { IdBudgetPeriod }
    }
}
