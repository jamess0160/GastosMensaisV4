import { BaseModel, MaybeArray } from "root/Utils/Base"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class class_Base_PasswordRecovery_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.from<BaseDatabase.PasswordRecoverys>("PasswordRecoverys").where("Active", 1).orderBy("IdPasswordRecovery")

    getAllActiveAndPending() {
        return this.baseQuery.clone().where("Approved", null)
    }

    getUnique(IdPasswordRecovery: number) {
        return this.baseQuery.clone().where("IdPasswordRecovery", IdPasswordRecovery).first()
    }

    create(records: MaybeArray<Partial<BaseDatabase.PasswordRecoverys>>) {
        return this.KnexConnection.insert(records).into("PasswordRecoverys")
    }

    updateStatus(IdPasswordRecovery: number, status: boolean) {
        return this.KnexConnection.from<BaseDatabase.PasswordRecoverys>("PasswordRecoverys").update({ Approved: status }).where("IdPasswordRecovery", IdPasswordRecovery)
    }
}

export const Base_PasswordRecovery_model = new class_Base_PasswordRecovery_model()