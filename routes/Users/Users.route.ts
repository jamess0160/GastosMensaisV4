import express from "express"
import { Users_controller } from "./Users.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Users_schema } from "./Users.schema"

export const Users_route = express()

Users_route.get("/Base/Users/login=:login/password=:password", Users_schema.validateLogin, AsyncHandler(Users_controller.validateLogin, false))

Users_route.get("/Base/Users/getSelf", Users_schema.getSelf, AsyncHandler(Users_controller.getSelf))

Users_route.post("/Base/Users", Users_schema.create, AsyncHandler(Users_controller.create))

Users_route.put("/Base/Users/IdUser=:IdUser", Users_schema.update, AsyncHandler(Users_controller.update))

Users_route.put("/Base/Users/updatePassword/newPassword=:newPassword", Users_schema.updatePassword, AsyncHandler(Users_controller.updatePassword))