import { APIError } from "root/Utils/Logs"
import { Users_model } from "../../Users.model"
import { AcessControl } from "../AcessControl.section"
import { Response } from "express"

export class GetSelf {
    public async run(IdUser: number, res: Response) {
        let user = await this.getUser(IdUser)

        if (!user) {
            AcessControl.clearTokenCookie(res)
            throw new APIError({ msg: "Usuário não encontrado!", status: 406 })
        }

        //  O hash da senha não vai para o cliente
        let { Password, ...self } = user

        return self
    }

    private getUser(IdUser: number) {
        return Users_model.getUnique(IdUser)
    }
}