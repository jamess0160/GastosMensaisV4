import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_SystemParams_controller } from "./SystemParams.controller"

export const Base_SystemParams_route = express()

Base_SystemParams_route.get("/Base/SystemParams/all/active", AsyncHandler(Base_SystemParams_controller.getAllActive))

Base_SystemParams_route.get("/Base/SystemParams/treeTable", AsyncHandler(Base_SystemParams_controller.getTreeTable))

Base_SystemParams_route.put("/Base/SystemParams/IdSystemParam=:IdSystemParam", AsyncHandler(Base_SystemParams_controller.update))