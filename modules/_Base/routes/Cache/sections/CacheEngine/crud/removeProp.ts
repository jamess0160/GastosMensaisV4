import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../../CacheEngine";
import { Logs } from "root/Utils/Logs";
import { CacheNamespace } from "../../types";
import { Utils } from "root/Utils/Utils";

export class RemoveProp extends BaseSection<CacheEngine> {

    public async run(type: string, key: string, options?: CacheNamespace.SetPropOptions) {

        this.log(type, key, options)

        this.instance.cache = Utils.removeNestedValue(`${type}.${key}`, this.instance.cache)

        if (options?.sendToSocket !== false) {
            await this.instance.fireSocket({ type, key })
        }
    }

    private log(type: string, key: string, options?: CacheNamespace.SetPropOptions) {
        Logs.insertCacheLog({
            msg: "Cache removeProp",
            data: {
                key: key,
                options: options,
                currentCache: this.instance.getProp(type, key)
            }
        }, type)
    }

}