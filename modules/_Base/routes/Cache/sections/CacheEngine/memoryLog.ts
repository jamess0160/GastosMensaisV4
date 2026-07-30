import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../CacheEngine";
import { Logs } from "root/Utils/Logs";
import moment from "moment";
import sizeof from "object-sizeof"

export class MemoryLog extends BaseSection<CacheEngine> {
    public run() {
        setInterval(() => {
            Logs.insertCacheLog({
                msg: "Consumo de memoria do cache",
                data: [
                    `Total: ${(sizeof(this.instance.cache) / 1024 / 1024).toFixed(2)} MB`,
                    ...Object.keys(this.instance.cache).map((key) => {
                        return `${key}: ${(sizeof(this.instance.cache[key]) / 1024 / 1024).toFixed(2)} MB`
                    })
                ]
            }, "Memory")
        }, moment.duration(1, "minute").asMilliseconds());
    }
}