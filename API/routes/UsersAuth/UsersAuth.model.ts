import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Credenciais WebAuthn (passkey/biometria). Carry-over da usersauth do V3.
export class class_UsersAuth_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.UsersAuth>("UsersAuth").where("Active", true).orderBy("IdUserAuth")

    getUnique(IdUserAuth: number) {
        return this.baseQuery.clone().where("IdUserAuth", IdUserAuth).first()
    }

    //  CredentialId é único na tabela inteira: é o id que o autenticador devolve na assinatura
    //  e é por ele que a autenticação descobre de quem é a credencial.
    getByCredentialId(CredentialId: string) {
        return this.baseQuery.clone().where("CredentialId", CredentialId).first()
    }

    getByUser(IdUser: number) {
        return this.baseQuery.clone().where("IdUser", IdUser)
    }

    //  Pode devolver credenciais de mais de um usuário: se duas pessoas usam o mesmo
    //  aparelho, as duas registram sob o mesmo DeviceKey. Quem resolve o usuário é o
    //  CredentialId escolhido pelo autenticador, não esta consulta.
    getByDeviceKey(DeviceKey: string) {
        return this.baseQuery.clone().where("DeviceKey", DeviceKey)
    }

    create(records: MaybeArray<Partial<Database.UsersAuth>>) {
        return this.KnexConnection.insert(records).into("UsersAuth")
    }

    update(IdUserAuth: number, record: Partial<Database.UsersAuth>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("UsersAuth").where("IdUserAuth", IdUserAuth)
    }

    //  Soft delete: a linha fica para o CredentialId continuar ocupado no índice único, senão
    //  um autenticador que ainda guarda a passkey poderia recadastrá-la como se fosse nova.
    delete(IdUserAuth: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("UsersAuth").where("IdUserAuth", IdUserAuth)
    }
}

export const UsersAuth_model = new class_UsersAuth_model()
