import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Users_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Users>("Users").where("Active", true).orderBy("IdUser")

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
        return this.baseQuery.clone().where("Email", login).first()
    }

    //  Fora do baseQuery de propósito: o índice único de Email não conhece o Active, então a
    //  checagem de e-mail livre no cadastro precisa enxergar também os usuários desativados.
    getByEmailIncludingInactive(Email: string) {
        return this.KnexConnection.select("*").from<Database.Users>("Users").where("Email", Email).first()
    }

    create(records: MaybeArray<Partial<Database.Users>>) {
        return this.KnexConnection.insert(records).into("Users")
    }

    //  O carimbo da confirmacao de e-mail, com metodo proprio como o `receive` de Inflows:
    //  quem confirma nao escolhe a data - ela e o instante do banco, e nao o do processo.
    confirmEmail(IdUser: number) {
        return this.update(IdUser, { EmailConfirmedAt: this.KnexConnection.fn.now() as unknown as Database.Users["EmailConfirmedAt"] })
    }

    update(IdUser: number, record: Partial<Database.Users>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Users").where("IdUser", IdUser)
    }

    delete(IdUser: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("Users").where("IdUser", IdUser)
    }
}

export const Users_model = new class_Users_model()