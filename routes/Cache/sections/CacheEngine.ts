import { Socket as SocketType } from "socket.io"
import { GetProp } from "./CacheEngine/crud/getProp"
import { SetProp } from "./CacheEngine/crud/setProp"
import { CacheNamespace } from "./types"
import { AttachConsummer } from "./CacheEngine/attachConsummer"
import { FireSocket } from "./CacheEngine/fireSocket"
import { Reset } from "./CacheEngine/crud/reset"
import { CacheUtils } from "./CacheEngine/utils"
import { MemoryLog } from "./CacheEngine/memoryLog"
import { CacheRoom } from "root/Utils/socket"

export class CacheEngine {

    private readonly GetProp = new GetProp(this)
    private readonly SetProp = new SetProp(this)
    private readonly AttachConsummer = new AttachConsummer(this)
    private readonly FireSocket = new FireSocket(this)
    private readonly Reset = new Reset(this)
    private readonly MemoryLog = new MemoryLog(this)

    public readonly CacheUtils = new CacheUtils(this)

    cache: Record<string, Record<string, unknown>> = {}
    events: Record<string, CacheNamespace.CacheConsummer> = {}

    constructor() {
        this.MemoryLog.run()
    }

    public getProp(type: string, key?: string) {
        return this.GetProp.run(type, key)
    }

    public setProp(type: string, key: string, value: unknown, options?: CacheNamespace.SetPropOptions) {
        return this.SetProp.run(type, key, value, options)
    }

    public attachConsummer(type: string, consummer: CacheNamespace.CacheConsummer) {
        return this.AttachConsummer.run(type, consummer)
    }

    public fireSocket(cacheRoom: CacheRoom, client?: SocketType) {
        return this.FireSocket.run(cacheRoom, client)
    }

    public reset(type: string) {
        return this.Reset.run(type)
    }
}

export const cacheEngine = new CacheEngine()