import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { class_Base_User_model } from "../../Users.model"
import { class_Base_UserInGroups_model } from "root/modules/_Base/routes/UserInGroups/UserInGroups.model"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class Update {
    public async run(IdUser: number, body: UpdateUser) {
        return KnexConnection.transaction(async (tx) => {
            const Base_User_model_tx = new class_Base_User_model(tx)
            const Base_UserInGroups_model_tx = new class_Base_UserInGroups_model(tx)

            let UserGroups = body.UserGroups

            delete body.UserGroups

            await Base_User_model_tx.update(IdUser, body)

            if (UserGroups) {
                await Base_UserInGroups_model_tx.deleteFromUser(IdUser)
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

interface UpdateUser extends BaseDatabase.Users {
    UserGroups?: string[]
}