import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_Utils_controller } from "./Utils.controller"
import { Base_Utils_schema } from "./Utils.schema"

export const Base_Utils_route = express()

Base_Utils_route.get("/Utils/ServerTime", Base_Utils_schema.getServerTime, AsyncHandler(Base_Utils_controller.getServerTime, false))

Base_Utils_route.get("/Utils/Health", Base_Utils_schema.health, AsyncHandler(Base_Utils_controller.health, false))

Base_Utils_route.post("/Utils/Logs", Base_Utils_schema.logs, AsyncHandler(Base_Utils_controller.logs))