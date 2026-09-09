import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../../CacheEngine";
import { Utils } from "root/Utils/Utils";

export class GetProp extends BaseSection<CacheEngine> {

    public run(type: string, key?: string): unknown | undefined {

        if (!this.instance.cache[type]) {
            return undefined
        }

        let path = key ? `${type}.${key}` : type

        let data = Utils.getNestedValue(path, this.instance.cache)

        let consummer = this.instance.events[type]

        return consummer.formatGet ? consummer.formatGet(data, key) : data
    }

}