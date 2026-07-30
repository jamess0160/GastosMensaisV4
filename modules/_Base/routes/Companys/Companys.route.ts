import express from "express"
import { Base_Companys_controller } from "./Companys.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"

export const Base_Companys_route = express()

Base_Companys_route.get("/Base/Companys/all/active", AsyncHandler(Base_Companys_controller.getAllActive))

Base_Companys_route.post("/Base/Companys", AsyncHandler(Base_Companys_controller.create))

Base_Companys_route.put("/Base/Companys/IdCompany=:IdCompany", AsyncHandler(Base_Companys_controller.update))

Base_Companys_route.delete("/Base/Companys/IdCompany=:IdCompany", AsyncHandler(Base_Companys_controller.delete))