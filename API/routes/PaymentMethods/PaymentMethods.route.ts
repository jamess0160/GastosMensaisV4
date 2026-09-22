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

//  **A fatura, como leitura.** Até a leva 9 ela só existia dentro do extrato, recortada pelo mês
//  selecionado — e a fatura **não é um mês**: "quanto já tem na que está aberta" é uma pergunta
//  sobre hoje, e "e a passada" obrigava a trocar o mês da aplicação inteira. Por isso o recorte
//  aqui é um **vencimento**, que é o que identifica uma fatura, e sem ele a resposta é a aberta.
//
//  GET numa feature que não tinha nenhum: a forma de pagamento continua saindo embutida na
//  conta, o que sai por aqui é a fatura — que não é linha de tabela nenhuma.
PaymentMethods_route.get("/PaymentMethods/IdPaymentMethod=:IdPaymentMethod/invoice", PaymentMethods_schema.getInvoice, AsyncHandler(PaymentMethods_controller.getInvoice))

//  **A fatura do cartão.** Ela já existe nos dados — todas as pernas de um ciclo compartilham o
//  mesmo DueDate exato —, então é uma consulta por (IdPaymentMethod, DueDate) e não um cadastro:
//  nenhuma tabela nova. É o `pay` em lote, e é o que faz o saldo do cartão finalmente descer.
PaymentMethods_route.post("/PaymentMethods/IdPaymentMethod=:IdPaymentMethod/payInvoice", PaymentMethods_schema.payInvoice, AsyncHandler(PaymentMethods_controller.payInvoice))

PaymentMethods_route.post("/PaymentMethods/IdPaymentMethod=:IdPaymentMethod/unpayInvoice", PaymentMethods_schema.unpayInvoice, AsyncHandler(PaymentMethods_controller.unpayInvoice))
