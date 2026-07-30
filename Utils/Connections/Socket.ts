import { Server, Socket as SocketType } from "socket.io"
import { Utils } from "../Utils"
import { criptManager } from "../criptManager"

Utils.configEnv()

type SocketHandler = (param: any, socket: SocketType, io: Server) => void

export abstract class SocketEngine {

    protected readonly io: Server

    private SocketRoutes: Record<string, SocketHandler> = {
        "leaveAllRooms": leaveAllRooms,
        "joinRoom": joinRoom
    }

    constructor() {
        this.io = this.configServer()
        this.setdefaultSocketRoutes()
    }

    private configServer() {
        let port = criptManager.getEnv("SOCKETPORT")

        return new Server({
            cors: {
                origin: "*"
            }
        }).listen(parseInt(port))
    }

    private setdefaultSocketRoutes() {
        this.io.on("connection", (socket) => {

            Object.keys(this.SocketRoutes).forEach((key) => {
                socket.on(key, (param) => {
                    this.SocketRoutes[key](param, socket, this.io)
                })
            })
        })
    }

    protected attachDefaultRoute(routeName: string, fn: SocketHandler) {
        this.SocketRoutes[routeName] = fn

        this.setdefaultSocketRoutes()
    }
}

function leaveAllRooms(_: any, socket: SocketType) {
    socket.rooms.forEach((room) => {
        if (room === socket.id) return
        socket.leave(room)
    })
}

function joinRoom(room: string, socket: SocketType) {
    socket.join(room)
}