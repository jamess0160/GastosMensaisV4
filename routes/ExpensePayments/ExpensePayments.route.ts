import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { ExpensePayments_controller } from "./ExpensePayments.controller"
import { ExpensePayments_schema } from "./ExpensePayments.schema"

export const ExpensePayments_route = express()

//  A perna do gasto: o eixo financeiro. Feature própria porque tem rota própria — mesmo
//  critério que separou PaymentMethods de Accounts. As outras duas filhas do gasto
//  (ExpensePersons e ExpenseTags) não têm rota e ficam como model dentro de routes/Expenses.
//
//  Quitar é **por perna**, porque a compra em 6x precisa saber qual parcela já foi paga. Esse
//  detalhe nunca vira status parcial no gasto: o Expenses.Status é recalculado a cada quitação
//  e só chega a 'paid' quando todas as pernas estão pagas.

ExpensePayments_route.post("/Base/ExpensePayments/IdExpensePayment=:IdExpensePayment/pay", ExpensePayments_schema.pay, AsyncHandler(ExpensePayments_controller.pay))

ExpensePayments_route.post("/Base/ExpensePayments/IdExpensePayment=:IdExpensePayment/unpay", ExpensePayments_schema.unpay, AsyncHandler(ExpensePayments_controller.unpay))
