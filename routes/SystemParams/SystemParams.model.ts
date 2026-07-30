import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Base_SystemParams_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.SystemParams>("SystemParams").where("Active", 1).orderBy("IdSystemParam")
    
    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdSystemParam: number) {
        return this.baseQuery.clone().where("IdSystemParam", IdSystemParam).first()
    }

    create(records: MaybeArray<Partial<Database.SystemParams>>, IdUser: number) {
        let lastChange = new Date()

        let dataArray = Array.isArray(records) ? records : [records]

        let insertRecord = dataArray.map(record => ({
            ...record,
            IdUser,
            lastChange
        }))

        return this.KnexConnection.insert<Database.SystemParams>(insertRecord).into("SystemParams")
    }

    update(IdSystemParam: number, records: Partial<Database.SystemParams>, IdUser: number) {
        let lastChange = new Date()
        return this.KnexConnection.update({...records, IdUser, lastChange}).from("SystemParams").where("IdSystemParam", IdSystemParam)
    }

    delete(IdSystemParam: number, IdUser: number) {
        let lastChange = new Date()
        return this.KnexConnection.update({ Active: 0, IdUser, lastChange }).from("SystemParams").where("IdSystemParam", IdSystemParam)
    }
}

export const Base_SystemParams_model = new class_Base_SystemParams_model()