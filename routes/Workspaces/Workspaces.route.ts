import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Workspaces_controller } from "./Workspaces.controller"
import { Workspaces_schema } from "./Workspaces.schema"

export const Workspaces_route = express()

//  Não há POST: hoje é um workspace por usuário e ele nasce dentro do cadastro
//  (routes/Users/sections/POST/create.ts), na mesma transaction que cria o usuário.
Workspaces_route.get("/Workspaces/getSelf", Workspaces_schema.getSelf, AsyncHandler(Workspaces_controller.getSelf))

//  Escolhe em qual workspace a sessão está. É a única rota que recebe um IdWorkspace escrito
//  pelo cliente, e a única que precisa: nas demais ele vem de dentro do token da sessão.
Workspaces_route.post("/Workspaces/switch", Workspaces_schema.switch, AsyncHandler(Workspaces_controller.switch))

//  Sem IdWorkspace no caminho: edita o workspace selecionado na sessão.
Workspaces_route.put("/Workspaces", Workspaces_schema.update, AsyncHandler(Workspaces_controller.update))
