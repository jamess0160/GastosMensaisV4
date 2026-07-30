import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Base_Permissions_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Permissions>("Permissions").where("Active", 1).orderBy("IdPermission")

    getByGroups(IdGroupNames: number[]) {
        return this.baseQuery.clone().whereIn("IdUserGroupName", IdGroupNames)
    }

    create(records: MaybeArray<Partial<Database.Permissions>>) {
        return this.KnexConnection.insert(records).into("Permissions")
    }

    delete(IdPermission: number) {
        return this.KnexConnection.update({ Active: 0 }).from("Permissions").where("IdPermission", IdPermission)
    }

    deletaAllFromGroup(IdUserGroupName: number) {
        return this.KnexConnection.update({ Active: 0 }).from<Database.Permissions>("Permissions").where("IdUserGroupName", IdUserGroupName)
    }
}

export const Base_Permissions_model = new class_Base_Permissions_model()