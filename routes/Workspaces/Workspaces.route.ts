import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Workspaces_controller } from "./Workspaces.controller"
import { Workspaces_schema } from "./Workspaces.schema"

export const Workspaces_route = express()

//  Não há POST: hoje é um workspace por usuário e ele nasce dentro do cadastro
//  (routes/Users/sections/POST/create.ts), na mesma transaction que cria o usuário.
Workspaces_route.get("/Base/Workspaces/getSelf", Workspaces_schema.getSelf, AsyncHandler(Workspaces_controller.getSelf))

Workspaces_route.put("/Base/Workspaces/IdWorkspace=:IdWorkspace", Workspaces_schema.update, AsyncHandler(Workspaces_controller.update))
