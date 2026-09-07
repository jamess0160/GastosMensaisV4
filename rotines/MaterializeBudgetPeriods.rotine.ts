import { CreateForMonth } from "root/routes/BudgetPeriods/sections/POST/createForMonth"
import { class_BudgetPeriods_model } from "root/routes/BudgetPeriods/BudgetPeriods.model"
import { class_Budgets_model } from "root/routes/Budgets/Budgets.model"
import { Utils } from "root/Utils/Utils"
import { runForEachWorkspace } from "./section/WorkspaceRunner"
import { RotinesNamespace } from "./section/types"

//  **Materializa o mês novo**: no dia 1º, cada definição ativa de orçamento vira uma linha
//  congelada em `BudgetPeriods`.
//
//  É rotina de verdade, e não materialização preguiçosa no `GET /Budgets`. A alternativa
//  barata — deixar o mês nascer na primeira leitura — foi descartada, e não por ter ficado
//  desnecessária com o motor: ela estava **errada para qualquer mês que não fosse o corrente**,
//  de um jeito que o teste feliz não pega.
//
//  - `GET /Budgets?ReferenceMonth=2026-03` criaria março **com o teto de hoje** e o congelaria.
//    É exatamente o que a tabela existe para impedir: a regra é "nunca leia o teto de um mês
//    passado no `Budgets`", e a leitura preguiçosa faria isso e ainda gravaria o resultado como
//    se fosse história.
//  - No sentido futuro é o mesmo: abrir dezembro em setembro congelaria o teto de setembro em
//    dezembro, e a rotina de 1º de dezembro passaria reto pelo mês já existente. O mês nasceria
//    errado e nada o corrigiria.
//  - E **dois escritores para uma linha congelada** só convergem enquanto o teto não muda entre
//    os dois momentos. Se mudou, quem chegou primeiro decidiu qual valor virou história — cara
//    ou coroa numa tabela cuja razão de existir é responder "qual era meu limite em março".
//
//  A rotina não tem nenhum dos três problemas porque roda **no dia em que o mês começa**: o
//  teto que ela congela é o que valia naquele dia, por definição, e ela é a única a escrever.
export const MaterializeBudgetPeriods: RotinesNamespace.Rotine = {

    name: "MaterializeBudgetPeriods",

    //  Dia 1º, de madrugada. O horário não é enfeite: com o processo em UTC, "00:30 do dia 1º"
    //  cai às 21:30 do dia 31 no Brasil e materializaria o mês errado. Ver o `TZ` do motor.
    schedule: { kind: "monthly", day: 1, hour: 3 },

    async run(ScheduledFor: string) {
        //  **O mês vem da ocorrência, nunca do relógio.** É a distinção inteira do catch-up:
        //  rodando no dia 2 uma ocorrência do dia 1º, é o mês do dia 1º que tem que nascer.
        let ReferenceMonth = Utils.monthStart(ScheduledFor.slice(0, 7))

        await runForEachWorkspace(MaterializeBudgetPeriods.name, async (workspace, tx) => {
            let Budgets_model = new class_Budgets_model(tx)
            let BudgetPeriods_model = new class_BudgetPeriods_model(tx)

            //  O baseQuery já filtra `Active = true`. **É aqui que o `Active` de `Budgets`
            //  finalmente passa a significar alguma coisa** — até hoje nada o lia, e "parar de
            //  orçar esta categoria" não tinha efeito nenhum.
            let budgets = await Budgets_model.getByWorkspace(workspace.IdWorkspace)

            if (!budgets.length) {
                return
            }

            //  **Só inserir o que falta, nunca atualizar.** A rotina não pode recriar o mês que
            //  o usuário cadastrou à mão nem sobrescrever o teto que ele ajustou no mês: o
            //  período é o mês *congelado*, e o que faz "qual era meu limite em março" ter
            //  resposta é justamente ele não ser recalculado.
            let existing = await BudgetPeriods_model.getByMonth(workspace.IdWorkspace, ReferenceMonth)
            let materialized = new Set(existing.map((period) => period.IdBudget))

            for (let budget of budgets) {
                if (materialized.has(budget.IdBudget)) {
                    continue
                }

                //  A section é reusada **sem um ajuste sequer**: ela nasceu recebendo a
                //  transaction e o mês exatamente para isto, e agora tem os três chamadores
                //  previstos — a rota, a rotina e o teste. A rotina delega, não reimplementa.
                await new CreateForMonth(tx).run(
                    workspace.IdWorkspace,
                    budget.IdBudget,
                    ReferenceMonth,
                    budget.LimitValue,
                    budget.AlertPercent,
                )
            }
        })
    },
}
