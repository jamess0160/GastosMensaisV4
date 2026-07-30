import { BaseModel, MaybeArray } from "root/Utils/Base"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class class_Base_UserGroupNames_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.from<BaseDatabase.UserGroupNames>("UserGroupNames").where("Active", 1).orderBy("IdUserGroupName")

    getAllActive() {
        return this.baseQuery.clone()
    }

    create(records: MaybeArray<Partial<BaseDatabase.UserGroupNames>>) {
        return this.KnexConnection.insert(records).into("UserGroupNames")
    }

    update(IdUserGroupName: number, record: Partial<BaseDatabase.UserGroupNames>) {
        return this.KnexConnection.update(record).from("UserGroupNames").where("IdUserGroupName", IdUserGroupName)
    }

    delete(IdUserGroupName: number) {
        return this.KnexConnection.update({ Active: 0 }).from("UserGroupNames").where("IdUserGroupName", IdUserGroupName)
    }
}

export const Base_UserGroupNames_model = new class_Base_UserGroupNames_model()