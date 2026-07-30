import { BaseModel, MaybeArray } from "root/Utils/Base"
import { BaseDatabase } from "root/modules/_Base/moduleDatabase"

export class class_Base_Plants_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<BaseDatabase.Plants>("Plants").where("Active", 1).orderBy("IdPlant")
    
    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdPlant: number) {
        return this.baseQuery.clone().where("IdPlant", IdPlant).first()
    }

    create(records: MaybeArray<Partial<BaseDatabase.Plants>>) {
        return this.KnexConnection.insert(records).into("Plants")
    }

    update(IdPlant: number, records: Partial<BaseDatabase.Plants>) {
        return this.KnexConnection.update(records).from("Plants").where("IdPlant", IdPlant)
    }

    delete(IdPlant: number) {
        return this.KnexConnection.update({ Active: 0 }).from("Plants").where("IdPlant", IdPlant)
    }
}

export const Base_Plants_model = new class_Base_Plants_model()