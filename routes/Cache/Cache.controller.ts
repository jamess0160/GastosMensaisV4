import { Request, Response } from "express"
import { cacheEngine } from "./sections/CacheEngine"

class Controller {

    getCache = async (req: Request, res: Response) => {
        let CacheName = req.params.CacheName

        res.json(await cacheEngine.getProp(CacheName))
    }

    setCache = async (req: Request, res: Response) => {
        let body = req.body as SetCachePayload

        await cacheEngine.setProp(body.cacheType, body.cacheKey, body.payload)

        res.json({ msg: "Sucesso!" })
    }

    resetCache = async (req: Request, res: Response) => {
        let CacheName = req.params.CacheName

        await cacheEngine.reset(CacheName)

        res.json({ msg: "Sucesso!" })
    }
}

interface SetCachePayload {
    cacheType: string,
    cacheKey: string,
    payload: any
}

export const Base_Cache_controller = new Controller()