import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Inflows_controller } from "./Inflows.controller"
import { Inflows_schema } from "./Inflows.schema"

export const Inflows_route = express()

//  Entradas **e** transferências entre contas, discriminadas pelo Kind — a primeira feature de
//  movimento, e a que estreia o saldo calculado (Accounts/sections/AccountBalance.section.ts).
//
//  InflowPersons não tem rota: o rateio é montado junto com a entrada e sai embutido no GET de
//  uma entrada só. Por isso é um segundo model dentro desta pasta, como WorkspaceMembers.

//  Lista do período: ?From=YYYY-MM-DD&To=YYYY-MM-DD (&Status=&Kind=). Sem Status, a cancelada
//  fica de fora. O formato do período é o mesmo de Expenses — ver Utils/joiSchemas.ts.
Inflows_route.get("/Base/Inflows", Inflows_schema.getByWorkspace, AsyncHandler(Inflows_controller.getByWorkspace))

Inflows_route.get("/Base/Inflows/IdInflow=:IdInflow", Inflows_schema.getUnique, AsyncHandler(Inflows_controller.getUnique))

Inflows_route.post("/Base/Inflows", Inflows_schema.create, AsyncHandler(Inflows_controller.create))

Inflows_route.put("/Base/Inflows/IdInflow=:IdInflow", Inflows_schema.update, AsyncHandler(Inflows_controller.update))

//  É o recebimento que entra no saldo, não o lançamento.
Inflows_route.post("/Base/Inflows/IdInflow=:IdInflow/receive", Inflows_schema.receive, AsyncHandler(Inflows_controller.receive))

//  Cancela (Status = canceled). Não há delete físico nem Active nesta tabela.
Inflows_route.delete("/Base/Inflows/IdInflow=:IdInflow", Inflows_schema.remove, AsyncHandler(Inflows_controller.remove))
