import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_UserGroupNames_controller } from "./UserGroupNames.controller"

export const Base_UserGroupNames_route = express()

Base_UserGroupNames_route.get("/Base/UserGroupNames/all/active", AsyncHandler(Base_UserGroupNames_controller.getAllActive))

Base_UserGroupNames_route.get("/Base/UserGroupNames/register", AsyncHandler(Base_UserGroupNames_controller.getToRegister))

Base_UserGroupNames_route.post("/Base/UserGroupNames", AsyncHandler(Base_UserGroupNames_controller.create))

Base_UserGroupNames_route.put("/Base/UserGroupNames/IdUserGroupName=:IdUserGroupName", AsyncHandler(Base_UserGroupNames_controller.update))

Base_UserGroupNames_route.delete("/Base/UserGroupNames/IdUserGroupName=:IdUserGroupName", AsyncHandler(Base_UserGroupNames_controller.delete))