//  O TestEnv precisa vir antes de qualquer import do app: é ele que carrega o .env.test
import "../TestEnv"
import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"
import { AcessControl } from "root/routes/Users/sections/AcessControl.section"
import { PasswordHasher } from "root/routes/Users/sections/PasswordHasher.section"
import { TestClient } from "../TestClient"

export interface TestUser {
    user: Database.Users
    /** Senha em texto puro, para conseguir logar depois */
    password: string
    /** Token JWT válido, para pular o login quando ele não é o objeto do teste */
    token: string
}

let sequence = 0

//  Semeia usuários direto no banco. É o único caminho hoje: POST /Base/Users exige token,
//  então o primeiro usuário de uma suíte não tem como nascer pela API.
export namespace UsersFactory {

    export const defaultPassword = "Senha@123"

    export async function create(overrides: Partial<Database.Users> = {}, password = defaultPassword): Promise<TestUser> {
        sequence++

        let [user] = await KnexConnection
            .insert({
                Name: "Usuário de teste",
                Email: buildEmail(),
                //  Mesmo hasher da API: o usuário semeado tem que conseguir logar pela rota real
                Password: await PasswordHasher.hash(password),
                Phone: 549987654321,
                ...overrides,
            })
            .into("Users")
            .returning("*") as Database.Users[]

        return {
            user,
            password,
            token: AcessControl.generateToken(user.IdUser),
        }
    }

    //  Usuário criado + cliente já autenticado com o token dele
    export async function createClient(overrides: Partial<Database.Users> = {}, password = defaultPassword) {
        let created = await create(overrides, password)

        return { ...created, client: new TestClient(created.token) }
    }

    export function buildEmail() {
        sequence++

        return `teste.${Date.now()}.${sequence}@gastos.local`
    }
}
