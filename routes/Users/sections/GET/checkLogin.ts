import { Base_User_model } from "../../Users.model"

export class CheckLogin {
    public async run(Login: string, IdCompany: number) {
        let user = await Base_User_model.getByLogin(Login).where("IdCompany", IdCompany)

        return { exists: Boolean(user) }
    }
}