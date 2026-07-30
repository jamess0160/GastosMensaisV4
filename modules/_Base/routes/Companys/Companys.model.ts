import { BaseModel, MaybeArray } from "root/Utils/Base"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class class_BASE_Companys_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<BaseDatabase.Companys>("Companys").where("Active", 1).orderBy("IdCompany")

    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdCompany: number) {
        return this.baseQuery.clone().where("IdCompany", IdCompany).first()
    }

    create(records: MaybeArray<Partial<BaseDatabase.Companys>>) {
        return this.KnexConnection.insert(records).into("Companys")
    }

    update(IdCompany: number, records: Partial<BaseDatabase.Companys>) {
        return this.KnexConnection.update(records).from("Companys").where("IdCompany", IdCompany)
    }

    delete(IdCompany: number) {
        return this.KnexConnection.update({ Active: 0 }).from("Companys").where("IdCompany", IdCompany)
    }
}

export const Base_Companys_model = new class_BASE_Companys_model()