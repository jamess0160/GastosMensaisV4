import { UserRegister } from "../../Users.controller"
import { Base_User_model } from "../../Users.model"

export class GetToRegister {
    public async run() {
        let users = await Base_User_model.getAllActive().joinActives({ UserInGroups: { selfPath: "IdUser" } })

        return users.map<UserRegister>((item) => {
            let groups = item.UserInGroups.map((item) => item.IdUserGroupName)

            return {
                ...item,
                UserGroups: groups,
                UserInGroups: undefined
            }
        })
    }
}