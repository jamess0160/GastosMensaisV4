import { CloseBudgetMonth } from "./CloseBudgetMonth.rotine"
import { RotinesNamespace } from "./section/types"

//  **O registro: a lista, e nada mais.** Mesmo papel do `Routes` em `routes/index.ts` — lá o
//  `server.ts` monta os sub-apps, aqui o `index.ts` entrega a lista ao motor.
//
//  `rotines/` mora na raiz, ao lado de `routes/`, porque é uma **segunda família de pontos de
//  entrada**: uma requisição HTTP e um horário vencido são as duas coisas que fazem código
//  deste projeto rodar. Enterrar a pasta em `Utils/` a descreveria errado.
//
//  E a grafia é `rotine`, não `routine`: `Logs/rotines/` e a flag `logFlags.rotine` já existem
//  escritos assim desde a V3, e uma pasta com a grafia certa ao lado de duas com a errada é
//  pior do que a coerência.
//
//  **Não existe uma tabela com esta lista.** Um catálogo em banco permitiria desligar no banco
//  uma rotina que o código ainda acha que existe. Ligar e desligar, quando precisar, é editar
//  esta lista — código, que o compilador confere e o deploy carrega junto.
export const Rotines: RotinesNamespace.Rotine[] = [
    //  **Uma só, desde a leva 9.** Eram duas — uma abria o mês novo materializando as
    //  definições perenes, a outra encerrava o velho. A primeira foi apagada junto com a
    //  tabela `Budgets`: nada nasce sozinho, um mês tem orçamento porque alguém o montou, e é
    //  isso que faz qualquer mês ser editável em vez de só o que a rotina já criou.
    //
    //  Esta ficou porque é a única coisa no sistema que sabe que um mês acabou, e o `ClosedAt`
    //  que ela carimba é a trava que impede reescrever a história de agosto em novembro.
    CloseBudgetMonth,
]
