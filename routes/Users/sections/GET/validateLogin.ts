import { APIError } from 'root/Utils/Logs'
import { Users_model } from '../../Users.model'
import { AcessControl } from '../AcessControl.section'
import { Response } from 'express'
import bcrypt from 'bcrypt'


export class ValidateLogin {
    public async run(res: Response, login: string, password: string) {

        const user = await Users_model.getByLogin(login)

        if (!user) {
            throw new APIError({
                msg: "Login inválido",
                status: 401,
            })
        }

        const isValid = await bcrypt.compare(password, user.Password)

        if (!isValid) {
            throw new APIError({
                msg: "Login inválido",
                status: 401,
            })
        }

        AcessControl.setTokenCookie(res, user.IdUser)
        return { msg: "Login realizado com sucesso" }
    }
}