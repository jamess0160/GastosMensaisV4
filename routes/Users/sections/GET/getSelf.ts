import { APIError } from "root/Utils/Logs"
import { Base_User_model } from "../../Users.model"
import { Base_Permissions_model } from "../../../Permissions/Permissions.model"

export class GetSelf {
    public async run(user_id: number) {
        let user = await this.getUser(user_id)

        if (!user) throw new APIError({ msg: "Usuário não encontrado!", status: 406 })

        let groups = user.UserInGroups.map((item) => item.UserGroupNames).flat()
        let permissions = await this.getPermissions(groups.map((item)=> item.IdUserGroupName))
        
        return Object.assign(user, {
            UserGroupNames: groups,
            UserInGroups: undefined,
            permissions
        })
    }

    private getUser(user_id: number) {
        return Base_User_model.getUnique(user_id).joinActives({
            UserInGroups: {
                selfPath: "IdUser",
                append(knex) {
                    return knex.joinActives({
                        UserGroupNames: { selfPath: "IdUserGroupName" }
                    })
                },
            },
        })
    }

    private getPermissions(UserGroupNameIds: number[]) {
        return Base_Permissions_model.getByGroups(UserGroupNameIds)
    }
}