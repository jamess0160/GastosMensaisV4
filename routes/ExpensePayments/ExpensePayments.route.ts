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
//
//  **Dois fatos, dois verbos, e um só deles move dinheiro:**
//
//      charge / uncharge  -> a cobrança entrou na fatura   (só cartão; não move saldo)
//      pay    / unpay     -> o dinheiro saiu da conta      (nunca no cartão: lá quem quita é a
//                                                           fatura, em PaymentMethods)

//  A lista das pernas que caem no período: coalesce(DueDate, ExpenseDate) dentro do intervalo,
//  com o gasto de origem e o rateio dele. É a lista do que **sai** no mês — GET /Expenses é a
//  lista do que foi **comprado**, e uma compra parcelada de março não aparece lá em agosto.
ExpensePayments_route.get("/ExpensePayments", ExpensePayments_schema.getByWorkspace, AsyncHandler(ExpensePayments_controller.getByWorkspace))

ExpensePayments_route.post("/ExpensePayments/IdExpensePayment=:IdExpensePayment/pay", ExpensePayments_schema.pay, AsyncHandler(ExpensePayments_controller.pay))

ExpensePayments_route.post("/ExpensePayments/IdExpensePayment=:IdExpensePayment/unpay", ExpensePayments_schema.unpay, AsyncHandler(ExpensePayments_controller.unpay))

ExpensePayments_route.post("/ExpensePayments/IdExpensePayment=:IdExpensePayment/charge", ExpensePayments_schema.charge, AsyncHandler(ExpensePayments_controller.charge))

ExpensePayments_route.post("/ExpensePayments/IdExpensePayment=:IdExpensePayment/uncharge", ExpensePayments_schema.uncharge, AsyncHandler(ExpensePayments_controller.uncharge))
