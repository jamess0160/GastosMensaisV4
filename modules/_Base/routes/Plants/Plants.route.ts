import express from "express"
import { Base_Plants_controller } from "./Plants.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"

export const Base_Plants_route = express()

Base_Plants_route.get("/Base/Plants/all/active", AsyncHandler(Base_Plants_controller.getAllActive))

Base_Plants_route.post("/Base/Plants", AsyncHandler(Base_Plants_controller.create))

Base_Plants_route.put("/Base/Plants/IdPlant=:IdPlant", AsyncHandler(Base_Plants_controller.update))

Base_Plants_route.delete("/Base/Plants/IdPlant=:IdPlant", AsyncHandler(Base_Plants_controller.delete))