import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_PasswordRecoverys_controller } from "./PasswordRecovery.controller"

export const Base_PasswordRecoverys_route = express()

Base_PasswordRecoverys_route.get("/Base/PasswordRecoverys", AsyncHandler(Base_PasswordRecoverys_controller.getAllActiveAndPending))

Base_PasswordRecoverys_route.post(`/Base/PasswordRecoverys/login=:login`, AsyncHandler(Base_PasswordRecoverys_controller.create, false))

Base_PasswordRecoverys_route.put("/Base/PasswordRecoverys/IdPasswordRecovery=:IdPasswordRecovery/status=:status", AsyncHandler(Base_PasswordRecoverys_controller.setStatus))