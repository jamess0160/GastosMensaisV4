//  O TestEnv precisa vir antes de qualquer import do app: é ele que carrega o .env.test
import "../TestEnv"
import crypto from "crypto"
import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"

let sequence = 0

//  Semeia credenciais WebAuthn direto no banco.
//
//  A chave pública é aleatória: nenhuma assinatura de verdade fecha com ela. Serve para tudo
//  que acontece ANTES da verificação — checkDevice, listagem, allowCredentials das options,
//  remoção. Verificar assinatura exige um autenticador de verdade e fica fora da suíte.
export namespace UsersAuthFactory {

    export async function create(IdUser: number, overrides: Partial<Database.UsersAuth> = {}): Promise<Database.UsersAuth> {
        let [credential] = await KnexConnection
            .insert({
                IdUser,
                CredentialId: buildCredentialId(),
                PublicKey: crypto.randomBytes(64),
                Counter: 0,
                DeviceKey: buildDeviceKey(),
                ...overrides,
            })
            .into("UsersAuth")
            .returning("*") as Database.UsersAuth[]

        return credential
    }

    export function buildCredentialId() {
        sequence++

        return `credential-${Date.now()}-${sequence}`
    }

    //  Mesmo formato do DeviceKey.section: base64url, para passar no schema das rotas
    export function buildDeviceKey() {
        return crypto.randomBytes(32).toString("base64url")
    }
}
