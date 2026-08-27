import { APIError } from 'root/Utils/Logs'
import { Users_model } from '../../Users.model'
import { AcessControl } from '../AcessControl.section'
import { PasswordHasher } from '../PasswordHasher.section'
import { Response } from 'express'

export class ValidateLogin {
    public async run(res: Response, login: string, password: string) {

        const user = await Users_model.getByLogin(login)

        if (!user) {
            //  Mesma mensagem e mesmo status do caso "senha errada": diferenciar os dois
            //  transforma a rota em um verificador de quais e-mails existem na base.
            throw new APIError({
                msg: "Login inválido",
                status: 401,
            })
        }

        const isValid = await PasswordHasher.compare(password, user.Password)

        if (!isValid) {
            throw new APIError({
                msg: "Login inválido",
                status: 401,
            })
        }

        await AcessControl.startSession(res, user.IdUser)

        return { msg: "Login realizado com sucesso" }
    }
}
