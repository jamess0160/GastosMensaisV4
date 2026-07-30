import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { class_Base_User_model } from "../../Users.model"
import { class_Base_UserInGroups_model } from "root/modules/_Base/routes/UserInGroups/UserInGroups.model"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class Create {
    public async run(body: CreateUser) {
        return KnexConnection.transaction(async (tx) => {
            const Base_User_model_tx = new class_Base_User_model(tx)
            const Base_UserInGroups_model_tx = new class_Base_UserInGroups_model(tx)

            let UserGroups = body.UserGroups

            delete body.UserGroups

            let [{ IdUser }] = await Base_User_model_tx.create(body).returning("IdUser")

            if (UserGroups) {
                await Base_UserInGroups_model_tx.create(UserGroups.map((item) => {
                    return {
                        IdUser: IdUser,
                        IdUserGroupName: parseInt(item),
                    }
                }))
            }

            return { msg: "Sucesso!" }
        })
    }
}

export interface CreateUser extends BaseDatabase.Users {
    UserGroups?: string[]
}