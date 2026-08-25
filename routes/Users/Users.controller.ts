import { AcessControl } from './sections/AcessControl.section'
import { Request, Response } from "express"
import { Database } from "root/Utils/database"
import { ValidateLogin } from './sections/POST/validateLogin'
import { Create } from './sections/POST/create'
import { Update } from './sections/PUT/update'
import { UpdatePassword } from './sections/PUT/updatePassword'
import { GetSelf } from './sections/GET/getSelf'

class Controller {

    validateLogin = async (req: Request, res: Response) => {
        let { login, password } = req.body

        res.json(await new ValidateLogin().run(res, login, password))
    }

    acessMiddleware = (req: Request, res: Response) => {
        let token = req.headers['authorization']

        if (!token) {
            res.status(401).send()
            return false
        }

        let result = AcessControl.verifyJwtToken(token)

        if (!result) {
            res.status(401).send()
            return false
        }

        res.locals.IdUser = result.id

        return true
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(Number(req.params.IdUser), req.body))
    }

    updatePassword = async (req: Request, res: Response) => {
        res.json(await new UpdatePassword().run(res.locals.IdUser, req.body.oldPassword, req.body.newPassword))
    }
}

export const Users_controller = new Controller()

export interface UserRegister extends Database.Users {
    UserGroups?: number[]
}