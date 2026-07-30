import { APIError } from "root/Utils/Logs"
import { Base_PasswordRecovery_model } from "../../PasswordRecovery.model"
import { Base_User_model } from "../../../Users/Users.model"

export class Create {
    public async run(login: string) {
        let user = await Base_User_model.getByLogin(login)

        if (!user) {
            throw new APIError({
                msg: "O Login informado não é válido!",
                status: 406
            })
        }

        return await Base_PasswordRecovery_model.create({ IdUserAsk: user.IdUser })
    }
}