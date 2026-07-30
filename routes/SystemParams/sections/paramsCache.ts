import { cacheEngine } from "../../Cache/sections/CacheEngine";
import { CacheNamespace } from "../../Cache/sections/types";
import { Base_SystemParams_model } from "../SystemParams.model";

export class SystemParamsCache implements CacheNamespace.CacheConsummer {

    static readonly CacheKey = "SystemParams"

    async restoreCacheData() {
        let params = await Base_SystemParams_model.getAllActive()

        cacheEngine.setProp(SystemParamsCache.CacheKey, "all", params)
    }
}