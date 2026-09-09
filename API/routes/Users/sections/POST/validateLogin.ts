import { APIError } from 'root/Utils/Logs'
import { Users_model } from '../../Users.model'
import { AcessControl } from '../AcessControl.section'
import { PasswordHasher } from '../PasswordHasher.section'
import { Response } from 'express'

export class ValidateLogin {
    public async run(res: Response, login: string, password: string, RememberDevice = false) {

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

        //  O "manter conectado" da tela: 30 dias em vez de 24h. Quem valida a credencial nao
        //  decide a duracao - so repassa o que o usuario pediu para o unico lugar que emite
        //  sessao, que e por onde o login por biometria passa tambem.
        await AcessControl.startSession(res, user.IdUser, RememberDevice)

        return { msg: "Login realizado com sucesso" }
    }
}
