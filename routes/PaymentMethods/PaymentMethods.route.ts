import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { PaymentMethods_controller } from "./PaymentMethods.controller"
import { PaymentMethods_schema } from "./PaymentMethods.schema"

export const PaymentMethods_route = express()

//  Feature própria, como toda tabela com rota. A ligação com Accounts é forte nos dois
//  sentidos — a conta nasce com pix e débito (sections/POST/createDefaults.ts, chamado de
//  dentro da transaction da conta) e o GET da conta embute as formas de pagamento — mas os
//  dois lados atravessam a fronteira por import explícito, não por morarem na mesma pasta.
//
//  O IdWorkspace vem do token da sessão, como em toda rota de tenant. O IdAccount vem no
//  body do POST: é escolha do cliente dentro do workspace já selecionado.

//  Só cartão de crédito passa por aqui. Pix e débito nascem com a conta, no POST /Accounts.
PaymentMethods_route.post("/PaymentMethods", PaymentMethods_schema.create, AsyncHandler(PaymentMethods_controller.create))

PaymentMethods_route.put("/PaymentMethods/IdPaymentMethod=:IdPaymentMethod", PaymentMethods_schema.update, AsyncHandler(PaymentMethods_controller.update))

PaymentMethods_route.delete("/PaymentMethods/IdPaymentMethod=:IdPaymentMethod", PaymentMethods_schema.remove, AsyncHandler(PaymentMethods_controller.remove))
