import { Request, Response } from "express"
import { Base_SystemParams_model } from "./SystemParams.model"
import { BuildParamTree } from "./sections/GET/treeTable"
import { cacheEngine } from "../Cache/sections/CacheEngine"
import { SystemParamsCache } from "./sections/paramsCache"

class Controller {

    constructor() {
        cacheEngine.attachConsummer(SystemParamsCache.CacheKey, new SystemParamsCache())
    }

    getAllActive = async (req: Request, res: Response) => {
        res.json(await Base_SystemParams_model.getAllActive())
    }

    getTreeTable = async (req: Request, res: Response) => {
        res.json(await new BuildParamTree().run())
    }

    update = async (req: Request, res: Response) => {
        let { IdUser } = res.locals
        res.json(await Base_SystemParams_model.update(parseInt(req.params.IdSystemParam), req.body, IdUser))
        cacheEngine.reset(SystemParamsCache.CacheKey)
    }
}

export const Base_SystemParams_controller = new Controller()