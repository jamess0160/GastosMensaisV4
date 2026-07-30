import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Base_Permissions_controller } from "./Permissions.controller"
import { Base_Permissions_schema } from "./Permissions.schema"

export const Base_Permissions_route = express()

Base_Permissions_route.get("/Base/Permissions/IdUserGroupName=:IdUserGroupName", Base_Permissions_schema.getGroupPermissions, AsyncHandler(Base_Permissions_controller.getGroupPermissions))

Base_Permissions_route.post("/Base/Permissions/IdUserGroupName=:IdUserGroupName", Base_Permissions_schema.postPermissions, AsyncHandler(Base_Permissions_controller.postPermissions))