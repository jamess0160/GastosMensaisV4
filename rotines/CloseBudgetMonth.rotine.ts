import { class_BudgetPeriods_model } from "root/routes/BudgetPeriods/BudgetPeriods.model"
import { Utils } from "root/Utils/Utils"
import { runForEachWorkspace } from "./section/WorkspaceRunner"
import { RotinesNamespace } from "./section/types"

//  **Fecha o mês que acabou**: no dia 1º, todo `BudgetPeriods` do mês anterior que ainda está
//  `open` passa a `closed`, com `ClosedAt` carimbado.
//
//  Anda junto com a materialização porque as duas são a mesma coisa vista dos dois lados da
//  virada — uma abre o mês novo, a outra encerra o velho. São **duas rotinas** e não uma porque
//  cada uma reivindica a sua linha em `RotineRuns`: um erro ao fechar agosto não pode deixar
//  setembro sem os tetos dele.
//
//  O fechamento é evento de *tempo*, não de leitura, e é por isso que ele nunca teve como
//  existir antes do motor: nenhuma rota podia decidir que um mês acabou.
export const CloseBudgetMonth: RotinesNamespace.Rotine = {

    name: "CloseBudgetMonth",

    schedule: { kind: "monthly", day: 1, hour: 3 },

    async run(ScheduledFor: string) {
        //  O mês da ocorrência é o que está começando; o que fecha é o anterior. E ele sai da
        //  ocorrência, não do relógio: rodando no dia 2 por catch-up, quem fecha ainda é o mês
        //  anterior ao do dia 1º.
        let ReferenceMonth = Utils.addMonthsToDate(Utils.monthStart(ScheduledFor.slice(0, 7)), -1)

        await runForEachWorkspace(CloseBudgetMonth.name, async (workspace, tx) => {
            //  Só o que está `open`: rodar de novo não reescreve o `ClosedAt` de quem já
            //  fechou. É o que torna a rotina convergente, que é a premissa do catch-up.
            await new class_BudgetPeriods_model(tx).closeMonth(workspace.IdWorkspace, ReferenceMonth)
        })
    },
}
