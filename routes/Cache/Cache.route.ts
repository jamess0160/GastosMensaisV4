import express from "express"
import { Base_Cache_controller } from "./Cache.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"

export const Base_Cache_route = express()

Base_Cache_route.get("/Base/Cache/CacheName=:CacheName", AsyncHandler(Base_Cache_controller.getCache))

Base_Cache_route.post("/Base/Cache", AsyncHandler(Base_Cache_controller.setCache))

Base_Cache_route.post("/Base/Cache/Reset/CacheName=:CacheName", AsyncHandler(Base_Cache_controller.resetCache))