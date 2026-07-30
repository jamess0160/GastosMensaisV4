import { class_Base_Permissions_model } from "../../Permissions.model";
import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection";

export class PostPermissions {

    async run(IdUserGroupName: number, SelectedKeys: string[], IdUser: number) {
        return KnexConnection.transaction(async (tx) => {
            const Base_Permissions_model_tx = new class_Base_Permissions_model(tx)

            await Base_Permissions_model_tx.deletaAllFromGroup(IdUserGroupName)

            if (SelectedKeys.length === 0) {
                return
            }

            await Base_Permissions_model_tx.create(SelectedKeys.map((item) => {
                return {
                    IdUserGroupName: IdUserGroupName,
                    Key: item,
                    IdUserChange: IdUser
                }
            }))
        })
    }
}