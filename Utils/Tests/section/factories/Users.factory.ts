//  O TestEnv precisa vir antes de qualquer import do app: é ele que carrega o .env.test
import "../TestEnv"
import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"
import { AcessControl } from "root/routes/Users/sections/AcessControl.section"
import { PasswordHasher } from "root/routes/Users/sections/PasswordHasher.section"
import { TestClient } from "../TestClient"

export interface TestUser {
    user: Database.Users
    /** O workspace que nasce junto com o usuário, como no cadastro real */
    workspace: Database.Workspaces
    /** A Person do próprio dono, que o cadastro também cria — é ela que entra nos rateios */
    person: Database.Persons
    /** Senha em texto puro, para conseguir logar depois */
    password: string
    /** Token JWT válido, para pular o login quando ele não é o objeto do teste */
    token: string
}

let sequence = 0

//  Semeia usuários direto no banco, para arranjar estado sem depender da rota de cadastro.
//  O workspace vem junto porque é assim que o POST /Users faz: usuário sem workspace não
//  existe no app, e um teste que partisse desse estado estaria testando algo impossível.
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

        let workspace = await createWorkspace(user)
        let person = await createSelfPerson(user, workspace)

        return {
            user,
            workspace,
            person,
            password,
            //  Token igual ao que o login emite: com o workspace dentro. Um token só com o
            //  IdUser é um estado que o app não produz para quem tem matrícula.
            token: buildToken(user.IdUser, workspace.IdWorkspace),
        }
    }

    //  Monta a sessão à mão, para os casos que o login não produz: sem workspace selecionado,
    //  ou apontando para o workspace de outro. É o que permite provar que o assertMember ainda
    //  barra um token legítimo cuja matrícula não existe — o token é assinado de verdade, o
    //  que não passa é a matrícula.
    export function buildToken(IdUser: number, IdWorkspace?: number) {
        return AcessControl.generateToken(IdUser, IdWorkspace)
    }

    //  Usuário criado + cliente já autenticado. O token dele carrega a sessão inteira, igual
    //  ao que o AcessControl.startSession emite no login real.
    export async function createClient(overrides: Partial<Database.Users> = {}, password = defaultPassword) {
        let created = await create(overrides, password)

        return { ...created, client: new TestClient(created.token) }
    }

    export function buildEmail() {
        sequence++

        return `teste.${Date.now()}.${sequence}@gastos.local`
    }

    //  O cadastro real cria a Person do dono na mesma transaction do usuário: todo rateio é
    //  entre Persons, então um usuário que não é pessoa nenhuma não consegue entrar no próprio.
    //  A fábrica segue o cadastro — semear o estado que o app não produz esconderia o bug.
    async function createSelfPerson(user: Database.Users, workspace: Database.Workspaces) {
        let [person] = await KnexConnection
            .insert({ IdWorkspace: workspace.IdWorkspace, IdUser: user.IdUser, Name: user.Name })
            .into("Persons")
            .returning("*") as Database.Persons[]

        return person
    }

    async function createWorkspace(user: Database.Users) {
        let [workspace] = await KnexConnection
            .insert({ Name: user.Name, IdOwnerUser: user.IdUser })
            .into("Workspaces")
            .returning("*") as Database.Workspaces[]

        //  A matrícula é o que faz o workspace aparecer nas leituras: sem ela o tenant é órfão
        await KnexConnection
            .insert({ IdWorkspace: workspace.IdWorkspace, IdUser: user.IdUser, Role: "owner" })
            .into("WorkspaceMembers")

        return workspace
    }
}
