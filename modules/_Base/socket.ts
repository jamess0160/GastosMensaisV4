import { SocketEngine } from "../../Utils/Connections/Socket";
import { cacheEngine } from "./routes/Cache/sections/CacheEngine";
import { Socket } from "socket.io"

class BaseSocket extends SocketEngine {

    constructor() {
        super()

        this.attachDefaultRoute("joinCacheRoom", joinCacheRoom)
        this.attachDefaultRoute("leaveCacheRoom", leaveCacheRoom)
    }

    public emmitReload() {
        this.io.emit("reload")
    }

    public sendCache(type: string, socketKey: string, value: any) {
        this.io.to(`${type}.${this}`).emit(`${type}.${socketKey}.value`, value)

        this.io.to(type).emit(`${type}.value`, {
            key: socketKey,
            data: value
        })
    }

    public sendCacheTo(type: string, socketKey: string, value: any, client?: Socket) {
        let route = `${type}.${socketKey}.value`

        if (!client) {
            return this.io.to(route).emit(route, value)
        }

        client.emit(route, value)
    }

    public sendTotalCacheTo(type: string, value: any, client?: Socket) {
        let route = `${type}.total`

        if (!client) {
            return this.io.to(route).emit(route, value)
        }

        client.emit(route, value)
    }
}

function joinCacheRoom(cacheRoom: CacheRoom, socket: Socket) {
    let roomName = cacheRoom.type

    if (cacheRoom.key) roomName += `.${cacheRoom.key}`

    socket.join(roomName)
    cacheEngine.fireSocket(cacheRoom, socket)
}

function leaveCacheRoom(cacheRoom: CacheRoom, socket: Socket) {
    let roomName = cacheRoom.type

    if (cacheRoom.key) roomName += `.${cacheRoom.key}`

    socket.leave(roomName)
}

export const baseSocket = new BaseSocket()

export interface CacheRoom {
    type: string
    key?: string
}