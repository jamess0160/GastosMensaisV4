import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Reports_controller } from "./Reports.controller"
import { Reports_schema } from "./Reports.schema"

export const Reports_route = express()

//  **A primeira feature sem tabela própria** — desvio consciente da convenção "uma pasta por
//  tabela", e ele se paga porque a feature é justamente a que lê de várias.
//
//  A razão de ela existir: as regras de agregação que o Dashboard usa **se contradizem de
//  propósito** (a transferência conta no saldo e não conta no "quanto entrou"; o orçamento
//  conta o pendente e o saldo não), e enquanto elas viviam replicadas no cliente, duas
//  implementações da mesma pergunta terminavam mostrando dois totais diferentes na mesma tela.
//
//  As sections daqui **delegam, nunca recalculam**: o `AccountBalance` e o `BudgetSpent` já
//  contêm as regras, e este arquivo é só mais um chamador — como o controller e o teste.

//  ?ReferenceMonth=YYYY-MM (opcional, default o mês corrente). Mês, e não From/To das listagens
//  de movimento: as duas pontas do cálculo são posições, não recortes.
Reports_route.get("/Reports/Month", Reports_schema.getMonth, AsyncHandler(Reports_controller.getMonth))
