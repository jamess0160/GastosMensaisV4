import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { BudgetPeriods_controller } from "./BudgetPeriods.controller"
import { BudgetPeriods_schema } from "./BudgetPeriods.schema"

export const BudgetPeriods_route = express()

//  O mês congelado do orçamento. Feature própria porque tem rota própria — mesmo critério que
//  separou PaymentMethods de Accounts e ExpensePayments de Expenses.
//
//  As duas rotas mexem **num mês só**, e é isso que a separação em duas tabelas compra:
//  "dezembro pode 1.500" não mexe na definição vigente nem em nenhum outro mês, e mudar a
//  definição não reescreve dezembro.

BudgetPeriods_route.put("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.update, AsyncHandler(BudgetPeriods_controller.update))

//  Delete físico: o período é plano, não lançamento. Ver sections/DELETE/remove.ts.
BudgetPeriods_route.delete("/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", BudgetPeriods_schema.remove, AsyncHandler(BudgetPeriods_controller.remove))
