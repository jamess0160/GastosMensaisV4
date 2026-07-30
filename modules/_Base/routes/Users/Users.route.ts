import express from "express"
import { Base_Users_controller } from "./Users.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_Users_schema } from "./Users.schema"

export const Base_Users_route = express()

Base_Users_route.get("/Base/Users/login=:login/password=:password", Base_Users_schema.validateLogin, AsyncHandler(Base_Users_controller.validateLogin, false))

Base_Users_route.get("/Base/Users/register", Base_Users_schema.getToRegister, AsyncHandler(Base_Users_controller.getToRegister))

Base_Users_route.get("/Base/Users/getSelf", Base_Users_schema.getSelf, AsyncHandler(Base_Users_controller.getSelf))

Base_Users_route.get("/Base/Users/checkLogin/Login=:Login", Base_Users_schema.checkLogin, AsyncHandler(Base_Users_controller.checkLogin))

Base_Users_route.post("/Base/Users", Base_Users_schema.create, AsyncHandler(Base_Users_controller.create))

Base_Users_route.put("/Base/Users/IdUser=:IdUser", Base_Users_schema.update, AsyncHandler(Base_Users_controller.update))

Base_Users_route.put("/Base/Users/updatePassword/newPassword=:newPassword", Base_Users_schema.updatePassword, AsyncHandler(Base_Users_controller.updatePassword))

Base_Users_route.delete("/Base/Users/IdUser=:IdUser", Base_Users_schema.delete, AsyncHandler(Base_Users_controller.delete))