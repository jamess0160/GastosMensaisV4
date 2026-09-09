import { CloseBudgetMonth } from "./CloseBudgetMonth.rotine"
import { MaterializeBudgetPeriods } from "./MaterializeBudgetPeriods.rotine"
import { RotinesNamespace } from "./section/types"

//  **O registro: a lista, e nada mais.** Mesmo papel do `Routes` em `routes/index.ts` — lá o
//  `server.ts` monta os sub-apps, aqui o `index.ts` entrega a lista ao motor.
//
//  `rotines/` mora na raiz, ao lado de `routes/`, porque é uma **segunda família de pontos de
//  entrada**: uma requisição HTTP e um horário vencido são as duas coisas que fazem código
//  deste projeto rodar. Enterrar a pasta em `Utils/` a descreveria errado.
//
//  E a grafia é `rotine`, não `routine`: `Logs/rotines/` e `constants.logs.rotine` já existem
//  escritos assim desde a V3, e uma pasta com a grafia certa ao lado de duas com a errada é
//  pior do que a coerência.
//
//  **Não existe uma tabela com esta lista.** Um catálogo em banco permitiria desligar no banco
//  uma rotina que o código ainda acha que existe. Ligar e desligar, quando precisar, sai do
//  `constants.json`.
export const Rotines: RotinesNamespace.Rotine[] = [
    //  As duas viradas do orçamento, no mesmo tick do dia 1º: uma abre o mês novo, a outra
    //  encerra o velho. Separadas porque cada uma reivindica a sua linha em RotineRuns — um
    //  erro ao fechar agosto não pode deixar setembro sem os tetos dele.
    MaterializeBudgetPeriods,
    CloseBudgetMonth,
]
