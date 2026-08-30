import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Budgets_controller } from "./Budgets.controller"
import { Budgets_schema } from "./Budgets.schema"

export const Budgets_route = express()

//  Orçamento: o teto de gasto de uma categoria em um mês.
//
//  **Entrega reduzida de propósito: o cadastro é mensal e manual.** O modelo é definição
//  (`Budgets`, uma linha por categoria) + mês congelado (`BudgetPeriods`, uma linha por mês), e
//  a rotina que materializa o mês a partir da definição **ainda não existe** — por enquanto é o
//  usuário quem informa o mês, e o POST faz as duas escritas numa transaction. Quando a rotina
//  chegar, ela reusa a mesma section do segundo passo (BudgetPeriods/sections/POST).
//
//  Orçamento é **só de gasto**: entrada não tem categoria, então não tem teto.

//  O mês inteiro, com quanto já foi comprometido em cada teto: ?ReferenceMonth=YYYY-MM
Budgets_route.get("/Budgets", Budgets_schema.getByMonth, AsyncHandler(Budgets_controller.getByMonth))

//  Orça uma categoria em um mês: resolve a definição vigente e cria o mês.
Budgets_route.post("/Budgets", Budgets_schema.create, AsyncHandler(Budgets_controller.create))
