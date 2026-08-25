import express from "express"
import { Users_controller } from "./Users.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Users_schema } from "./Users.schema"

export const Users_route = express()

//  Senha nunca vai na URL: o path inteiro cai no log de acesso do proxy, no histórico do
//  browser, no header Referer e no próprio Logs.handleError. Login e troca de senha vão no body.
Users_route.post("/Base/Users/login", Users_schema.validateLogin, AsyncHandler(Users_controller.validateLogin, false))

Users_route.get("/Base/Users/getSelf", Users_schema.getSelf, AsyncHandler(Users_controller.getSelf))

Users_route.post("/Base/Users", Users_schema.create, AsyncHandler(Users_controller.create, false))

Users_route.put("/Base/Users/IdUser=:IdUser", Users_schema.update, AsyncHandler(Users_controller.update))

Users_route.put("/Base/Users/updatePassword", Users_schema.updatePassword, AsyncHandler(Users_controller.updatePassword))