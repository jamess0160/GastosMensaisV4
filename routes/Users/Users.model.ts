import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Users_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Users>("Users").where("Active", 1).orderBy("IdUser")

    getByLoginAndPassword(login: string, password: string) {
        return this.baseQuery.clone().where("Login", login).where("Pass", password).first()
    }

    getAllActive() {
        return this.baseQuery.clone()
    }

    getUnique(IdUser: number) {
        return this.baseQuery.clone().where("IdUser", IdUser).first()
    }

    getByLogin(login: string) {
        return this.baseQuery.clone().where("Login", login).first()
    }

    create(records: MaybeArray<Partial<Database.Users>>) {
        return this.KnexConnection.insert(records).into("Users")
    }

    update(IdUser: number, record: Partial<Database.Users>) {
        return this.KnexConnection.update({ ...record, UpdateAt: this.KnexConnection.fn.now() }).from("Users").where("IdUser", IdUser)
    }

    delete(IdUser: number) {
        return this.KnexConnection.update({ Active: 0 }).from("Users").where("IdUser", IdUser)
    }
}

export const Users_model = new class_Users_model()