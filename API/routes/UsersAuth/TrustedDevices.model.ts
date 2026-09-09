import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Carry-over da ignoreauth do V3: o aparelho em que o usuário já disse que NÃO quer
//  biometria. Serve para o cliente não reperguntar a cada abertura — é o que separa
//  "ainda não perguntei" de "perguntei e ele recusou".
export class class_TrustedDevices_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.TrustedDevices>("TrustedDevices").where("Active", true).orderBy("IdTrustedDevice")

    getByUser(IdUser: number) {
        return this.baseQuery.clone().where("IdUser", IdUser)
    }

    getByDeviceKey(DeviceKey: string) {
        return this.baseQuery.clone().where("DeviceKey", DeviceKey)
    }

    getUnique(IdUser: number, DeviceKey: string) {
        return this.baseQuery.clone().where("IdUser", IdUser).where("DeviceKey", DeviceKey).first()
    }

    create(records: MaybeArray<Partial<Database.TrustedDevices>>) {
        return this.KnexConnection.insert(records).into("TrustedDevices")
    }

    //  (IdUser, DeviceKey) é único: reativa a linha em vez de estourar o índice quando o
    //  usuário recusa de novo depois de ter voltado atrás uma vez.
    upsert(IdUser: number, DeviceKey: string) {
        return this.KnexConnection
            .insert({ IdUser, DeviceKey })
            .into("TrustedDevices")
            .onConflict(["IdUser", "DeviceKey"])
            .merge({ Active: true, UpdatedAt: this.KnexConnection.fn.now() })
    }

    deleteByUserAndDevice(IdUser: number, DeviceKey: string) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("TrustedDevices").where("IdUser", IdUser).where("DeviceKey", DeviceKey)
    }
}

export const TrustedDevices_model = new class_TrustedDevices_model()
