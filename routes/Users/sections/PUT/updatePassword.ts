import { APIError } from "root/Utils/Logs"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"

export class UpdatePassword {
    public async run(IdUser: number, oldPassword: string, newPassword: string) {

        let user = await this.getUser(IdUser)
        let compareResult = await PasswordHasher.compare(oldPassword, user.Password)

        if (compareResult === false) {
            throw new APIError({
                msg: "Senha antiga não bate com a senha registrada",
                status: 406,
            })
        }

        await Users_model.update(IdUser, {
            Password: await PasswordHasher.hash(newPassword),
        })
    }

    private async getUser(IdUser: number) {
        let user = await Users_model.getUnique(IdUser)

        if (!user) {
            throw new Error(`Usuário #${IdUser} não encontrado!`)
        }

        return user
    }
}
