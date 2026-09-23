import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { BudgetPeriods_controller } from "./BudgetPeriods.controller"
import { BudgetPeriods_schema } from "./BudgetPeriods.schema"

export const BudgetPeriods_route = express()

//  **O orçamento é uma repartição da renda de um mês**, e cada linha aqui é uma fatia dela.
//
//  O exemplo que definiu o modelo, com 1.000 recebidos: `Luana 250`, `Tiago em Alimentação
//  250`, `Mercado 500`. Três formatos de alvo — só pessoa, só categoria, e os dois juntos — e
//  as fatias **somam lado a lado**: "Luana 250" mais "Luana em Mercado 100" dão 350 para a
//  Luana. Não há aninhamento nem teto dentro de teto, e a soma de todas as linhas é o quanto do
//  mês foi alocado.
//
//  **A feature `Budgets` foi absorvida por esta na leva 9.** O teto perene por alvo — "mercado:
//  800/mês, para sempre" — e a rotina que o congelava no dia 1º acabaram juntos: o mês não
//  nasce mais sozinho, ele é montado. Com isso **qualquer mês é legível e editável**, passado,
//  corrente ou futuro, e outubro pode ser montado em setembro — que é o que o modelo anterior
//  não tinha como oferecer.
//
//  **O que sobrou da máquina do mês é o `ClosedAt`.** `CloseBudgetMonth` continua sendo a única
//  coisa que sabe que um mês acabou, e o carimbo dela ganhou um segundo uso: mês fechado recusa
//  escrita nas três rotas abaixo. É a trava que impede reescrever a história de agosto em
//  novembro.
//
//  Orçamento é **só de gasto**: entrada não tem categoria.

//  O mês inteiro, com quanto já foi comprometido em cada fatia: ?ReferenceMonth=YYYY-MM
BudgetPeriods_route.get("/BudgetPeriods", BudgetPeriods_schema.getByMonth, AsyncHandler(BudgetPeriods_controller.getByMonth))

//  Uma fatia nova no mês. Uma escrita só — não há mais definição para resolver antes.
BudgetPeriods_route.post("/BudgetPeriods", BudgetPeriods_schema.create, AsyncHandler(BudgetPeriods_controller.create))

BudgetPeriods_route.put("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.update, AsyncHandler(BudgetPeriods_controller.update))

//  Delete físico: a fatia é plano, não lançamento. Ver sections/DELETE/remove.ts.
BudgetPeriods_route.delete("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.remove, AsyncHandler(BudgetPeriods_controller.remove))
