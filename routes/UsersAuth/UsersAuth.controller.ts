import { Request, Response } from "express"
import { Remove } from "./sections/DELETE/remove"
import { CheckDevice } from "./sections/GET/checkDevice"
import { GetLoginOptions } from "./sections/GET/getLoginOptions"
import { GetRegisterOptions } from "./sections/GET/getRegisterOptions"
import { GetSelf } from "./sections/GET/getSelf"
import { Authenticate } from "./sections/POST/authenticate"
import { Register } from "./sections/POST/register"
import { SkipDevice } from "./sections/POST/skipDevice"

class Controller {

    checkDevice = async (req: Request, res: Response) => {
        res.json(await new CheckDevice().run(req.params.DeviceKey))
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    getRegisterOptions = async (req: Request, res: Response) => {
        res.json(await new GetRegisterOptions().run(res.locals.IdUser))
    }

    getLoginOptions = async (req: Request, res: Response) => {
        res.json(await new GetLoginOptions().run(req.params.DeviceKey))
    }

    register = async (req: Request, res: Response) => {
        res.json(await new Register().run(res.locals.IdUser, req.body))
    }

    authenticate = async (req: Request, res: Response) => {
        res.json(await new Authenticate().run(res, req.body))
    }

    skipDevice = async (req: Request, res: Response) => {
        res.json(await new SkipDevice().run(res.locals.IdUser, req.body))
    }

    remove = async (req: Request, res: Response) => {
        res.json(await new Remove().run(Number(req.params.IdUserAuth), res.locals.IdUser))
    }
}

export const UsersAuth_controller = new Controller()
