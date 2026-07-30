import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Base_UserInGroups_model extends BaseModel {
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.UserInGroups>("UserInGroups").where("Active", 1).orderBy("IdUserGroupName")

    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdUserInGroup: number) {
        return this.baseQuery.clone().where("IdUserInGroup", IdUserInGroup).first()
    }

    create(records: MaybeArray<Partial<Database.UserInGroups>>) {
        return this.KnexConnection.insert(records).into("UserInGroups")
    }

    update(IdUserInGroup: number, record: Partial<Database.UserInGroups>) {
        return this.KnexConnection.update(record).from("UserInGroups").where("IdUserInGroup", IdUserInGroup)
    }

    delete(IdUserInGroup: number) {
        return this.KnexConnection.update({ Active: 0 }).from("UserInGroups").where("IdUserInGroup", IdUserInGroup)
    }

    deleteFromUser(IdUser: number) {
        return this.KnexConnection.update({ Active: 0 }).from("UserInGroups").where("IdUser", IdUser)
    }
}

export const Base_UserInGroups_model = new class_Base_UserInGroups_model()