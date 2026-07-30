import { Base_AcessControl } from './sections/AcessControl.section'
import { Request, Response } from "express"
import { Base_User_model } from './Users.model'
import { Database } from "root/Utils/database"
import { ValidateLogin } from './sections/GET/validateLogin'
import { GetToRegister } from './sections/GET/getToRegister'
import { CheckLogin } from './sections/GET/checkLogin'
import { Create } from './sections/POST/create'
import { Update } from './sections/PUT/update'
import { GetSelf } from './sections/GET/getSelf'

class Controller {

    validateLogin = async (req: Request, res: Response) => {
        let { login, password } = req.params

        res.json(await new ValidateLogin().run(login, password))
    }

    acessMiddleware = (req: Request, res: Response) => {
        let token = req.headers['authorization']

        if (!token) {
            res.status(401).send()
            return false
        }

        let result = Base_AcessControl.verifyJwtToken(token)

        if (!result) {
            res.status(401).send()
            return false
        }

        res.locals.IdUser = result.id

        return true
    }

    getToRegister = async (req: Request, res: Response) => {
        res.json(await new GetToRegister().run())
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
    }

    checkLogin = async (req: Request, res: Response) => {
        let { Login, IdCompany } = req.params

        res.json(await new CheckLogin().run(Login, Number(IdCompany)))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(Number(req.params.IdUser), req.body))
    }

    updatePassword = async (req: Request, res: Response) => {
        res.json(await Base_User_model.update(res.locals.IdUser, { Pass: req.params.newPassword }))
    }

    delete = async (req: Request, res: Response) => {
        res.json(await Base_User_model.delete(parseInt(req.params.IdUser)))
    }
}

export const Base_Users_controller = new Controller()

export interface UserRegister extends Database.Users {
    UserGroups?: number[]
}