import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Base_PasswordRecovery_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.from<Database.PasswordRecoverys>("PasswordRecoverys").where("Active", 1).orderBy("IdPasswordRecovery")

    getAllActiveAndPending() {
        return this.baseQuery.clone().where("Approved", null)
    }

    getUnique(IdPasswordRecovery: number) {
        return this.baseQuery.clone().where("IdPasswordRecovery", IdPasswordRecovery).first()
    }

    create(records: MaybeArray<Partial<Database.PasswordRecoverys>>) {
        return this.KnexConnection.insert(records).into("PasswordRecoverys")
    }

    updateStatus(IdPasswordRecovery: number, status: boolean) {
        return this.KnexConnection.from<Database.PasswordRecoverys>("PasswordRecoverys").update({ Approved: status }).where("IdPasswordRecovery", IdPasswordRecovery)
    }
}

export const Base_PasswordRecovery_model = new class_Base_PasswordRecovery_model()