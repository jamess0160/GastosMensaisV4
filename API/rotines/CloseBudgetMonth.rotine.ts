import { class_BudgetPeriods_model } from "root/routes/BudgetPeriods/BudgetPeriods.model"
import { Utils } from "root/Utils/Utils"
import { runForEachWorkspace } from "./section/WorkspaceRunner"
import { RotinesNamespace } from "./section/types"

//  **Fecha o mês que acabou**: no dia 1º, todo `BudgetPeriods` do mês anterior que ainda está
//  `open` passa a `closed`, com `ClosedAt` carimbado.
//
//  **É a única rotina do orçamento desde a leva 9.** Ela andava junto com uma
//  `MaterializeBudgetPeriods`, que abria o mês novo a partir das definições perenes de
//  `Budgets` — as duas morreram juntas quando o orçamento virou uma repartição da renda do mês:
//  nada nasce sozinho, um mês tem orçamento porque alguém o montou.
//
//  Esta ficou, e o carimbo dela ganhou um segundo uso. O fechamento é evento de *tempo*, não de
//  leitura, e é por isso que ele nunca teve como existir antes do motor: nenhuma rota podia
//  decidir que um mês acabou. Agora **mês fechado não aceita escrita** — é o `ClosedAt` daqui
//  que impede reescrever a história de agosto em novembro, que era a razão pela qual o período
//  existia congelado.
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
