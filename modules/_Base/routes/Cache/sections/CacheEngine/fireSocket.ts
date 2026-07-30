import { BaseSection } from "root/Utils/Base";
import { CacheEngine } from "../CacheEngine";
import { baseSocket, CacheRoom } from "root/modules/_Base/socket";
import { Socket as SocketType } from "socket.io"

export class FireSocket extends BaseSection<CacheEngine> {

    public run(cacheRoom: CacheRoom, client?: SocketType) {
        if (!this.instance.cache[cacheRoom.type]) return

        if (cacheRoom.key) {
            return this.fireKeySocket(cacheRoom.type, cacheRoom.key, client)
        } else {
            return this.fireCompleteSocket(cacheRoom.type, client)
        }
    }

    private async fireKeySocket(type: string, key: string, client?: SocketType) {
        let { socketKey, value } = await this.instance.CacheUtils.getSocketInfo(type, key)

        if (!value) return

        baseSocket.sendCacheTo(type, socketKey, value, client)
    }

    private async fireCompleteSocket(type: string, client?: SocketType) {
        let keys = Object.keys(this.instance.cache[type])

        let cacheFormattedData: Record<string, unknown> = {}

        for await (let key of keys) {
            let { socketKey, value } = await this.instance.CacheUtils.getSocketInfo(type, key)

            cacheFormattedData[socketKey] = value
        }

        baseSocket.sendTotalCacheTo(type, Object.values(cacheFormattedData), client)
    }

}