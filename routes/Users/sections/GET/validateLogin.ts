import { APIError } from 'root/Utils/Logs'
import { Base_User_model } from '../../Users.model'
import { Base_AcessControl } from '../AcessControl.section'


export class ValidateLogin {
    public async run(login: string, password: string) {
        let user = await Base_User_model.getByLoginAndPassword(login, password)

        if (!user) {
            throw new APIError({
                msg: "Login inválido",
                status: 401
            })
        }

        return { token: Base_AcessControl.generateToken(user.IdUser) }
    }
}