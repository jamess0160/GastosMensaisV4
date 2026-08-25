import { APIError } from "root/Utils/Logs"
import { Users_model } from "../../Users.model"

export class GetSelf {
    public async run(IdUser: number) {
        let user = await this.getUser(IdUser)

        if (!user) throw new APIError({ msg: "Usuário não encontrado!", status: 406 })

        //  O hash da senha não vai para o cliente
        let { Password, ...self } = user

        return self
    }

    private getUser(IdUser: number) {
        return Users_model.getUnique(IdUser)
    }
}