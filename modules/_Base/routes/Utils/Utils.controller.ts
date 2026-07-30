import { Request, Response } from "express"
import { Logs } from "root/Utils/Logs"
import { BaseUtilsNamespace } from "./sections/types"
import { criptManager } from "root/Utils/criptManager"
import { baseSocket } from "../../socket"

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

    encript = async (req: Request, res: Response) => {
        let text = req.params.Text as string

        res.json({
            result: criptManager.encript(text)
        })
    }

    reload = async (req: Request, res: Response) => {
        baseSocket.emmitReload()

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