import { Request, Response } from "express"
import { Logs } from "root/Utils/Logs"
import { BaseUtilsNamespace } from "./sections/types"
import { socket } from "root/Utils/socket"

class Controller {

    getServerTime = async (req: Request, res: Response) => {
        res.json(Date.now())
    }

    health = async (req: Request, res: Response) => {
        res.json({
            msg: "API Funcionando",
            timeStamp: Date.now(),
            serverTime: new Date().toLocaleString("pt-br"),
        })
    }

    reload = async (req: Request, res: Response) => {
        socket.emmitReload()

        res.send("Mensagem socket enviada com sucesso!")
    }

    logs = async (req: Request, res: Response) => {
        let body = req.body as BaseUtilsNamespace.LogBody

        Logs.insertLog({
            ...body.Log,
            IdUser: res.locals.IdUser
        }, body.Type)

        res.send("Sucesso")
    }
}

export const Base_Utils_controller = new Controller()