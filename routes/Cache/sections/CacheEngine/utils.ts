import { BaseSection } from "root/Utils/Base"
import { CacheEngine } from "../CacheEngine"
import { CacheNamespace } from "../types"
import { Utils } from "root/Utils/Utils"

export class CacheUtils extends BaseSection<CacheEngine> {
    public async getSocketInfo(type: string, key: string): Promise<CacheNamespace.SocketInfo> {
        let consumer = this.instance.events[type]

        let value = this.instance.getProp(type, key)

        if (consumer.formatSocket) {
            return await Utils.validatePromise(consumer.formatSocket(key, value))
        }

        return {
            socketKey: key,
            value: value
        }
    }
}