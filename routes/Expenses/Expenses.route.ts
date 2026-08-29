import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Expenses_controller } from "./Expenses.controller"
import { Expenses_schema } from "./Expenses.schema"

export const Expenses_route = express()

//  O gasto nos três formatos, na mesma tabela e no mesmo POST: 'single', 'installment' (600 em
//  6x = 6 pernas) e 'fixed' (uma corrente de ocorrências reais, não molde + instâncias).
//
//  **Os dois eixos de rateio não se misturam:** ExpensePayments é o financeiro (move saldo),
//  ExpensePersons é o analítico (de quem é o custo). Duas formas de pagamento e duas pessoas
//  dão 2 + 2 linhas, nunca 4.
//
//  ExpensePersons e ExpenseTags são montadas junto com o gasto e não têm rota — por isso são
//  models desta pasta. ExpensePayments tem rota (o quitar) e por isso é pasta própria.

Expenses_route.get("/Base/Expenses", Expenses_schema.getByWorkspace, AsyncHandler(Expenses_controller.getByWorkspace))

Expenses_route.get("/Base/Expenses/IdExpense=:IdExpense", Expenses_schema.getUnique, AsyncHandler(Expenses_controller.getUnique))

Expenses_route.post("/Base/Expenses", Expenses_schema.create, AsyncHandler(Expenses_controller.create))

Expenses_route.put("/Base/Expenses/IdExpense=:IdExpense", Expenses_schema.update, AsyncHandler(Expenses_controller.update))

//  A série de um gasto fixo, da ocorrência escolhida para a frente. O corte é a data dela, não
//  o relógio: ocorrência passada guarda o valor que realmente valeu.
Expenses_route.put("/Base/Expenses/IdExpense=:IdExpense/series", Expenses_schema.updateSeries, AsyncHandler(Expenses_controller.updateSeries))

Expenses_route.delete("/Base/Expenses/IdExpense=:IdExpense", Expenses_schema.remove, AsyncHandler(Expenses_controller.remove))

Expenses_route.delete("/Base/Expenses/IdExpense=:IdExpense/series", Expenses_schema.removeSeries, AsyncHandler(Expenses_controller.removeSeries))
