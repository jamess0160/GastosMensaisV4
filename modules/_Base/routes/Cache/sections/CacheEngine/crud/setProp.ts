import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../../CacheEngine";
import { Utils } from "root/Utils/Utils";
import { baseSocket } from "root/modules/_Base/socket";
import { CacheNamespace } from "../../types";
import { Logs } from "root/Utils/Logs";

export class SetProp extends BaseSection<CacheEngine> {

    public async run(type: string, key: string, value: unknown, options?: CacheNamespace.SetPropOptions) {

        let formattedData = await this.getFormattedSetData(type, key, value, options)

        this.log(type, key, value, formattedData, options)

        this.instance.cache = Utils.setNestedValue(`${type}.${key}`, this.instance.cache, formattedData)

        if (options?.sendToSocket !== false) {
            await this.sendToSocket(type, key)
        }
    }

    private getFormattedSetData(type: string, key: string, value: unknown, options?: CacheNamespace.SetPropOptions) {
        let consumer = this.instance.events[type]

        if (consumer.formatSet && options?.fireFormatter !== false) {
            return Utils.validatePromise(consumer.formatSet(key, value))
        }

        return Utils.validatePromise(value)
    }

    private log(type: string, key: string, value: unknown, formattedData: any, options?: CacheNamespace.SetPropOptions) {
        let consumer = this.instance.events[type]

        Logs.insertCacheLog({
            msg: "Cache SetProp",
            data: {
                key: key,
                value: consumer.LogValue !== false ? value : undefined,
                options: options,
                formattedData: consumer.LogFormattedData !== false ? formattedData : undefined,
                currentCache: consumer.LogCurrentCache !== false ? structuredClone(Utils.getNestedValue(`${type}.${key}`, this.instance.cache)) : undefined,
            }
        }, type)
    }

    private async sendToSocket(type: string, key: string) {

        let { socketKey, value } = await this.instance.CacheUtils.getSocketInfo(type, key)

        baseSocket.sendCache(type, socketKey, value)
    }
}