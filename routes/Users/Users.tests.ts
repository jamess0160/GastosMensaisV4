import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"
import { UsersNamespace } from "./sections/types"

//  Testes integrados da feature Users. Um describe por rota de Users.route.ts, na mesma ordem.
//
//  Nada é mockado: a requisição passa pelo AsyncHandler, pelo schema Joi, pelas sections e
//  chega no banco de teste (recriado a cada execução pelo globalSetup). As asserções olham a
//  resposta HTTP e, quando faz diferença, a linha gravada.
//
//  npm test                                          -> app em memória (supertest)
//  TEST_BASE_URL=http://localhost:4000 npm test      -> mesmo arquivo, servidor real (end to end)

describe("Users", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        //  Estado conhecido no início da suíte. CASCADE: leva junto tudo que depende de Users.
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Usuário raiz" })
        client = new TestClient(root.token)
    })

    describe("POST /Base/Users/login", () => {

        it("autentica com as credenciais corretas e devolve o token", async () => {
            let response = await client.anonymous().post("/Base/Users/login", { login: root.user.Email, password: root.password })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ msg: "Login realizado com sucesso" })
            expect(TestClient.extractCookieToken(response)).toBeTruthy()
        })

        it("recusa a senha errada", async () => {
            let response = await client.anonymous().post("/Base/Users/login", { login: root.user.Email, password: "senha-errada" })

            expect(response.status).toBe(401)
            expect(TestClient.extractCookieToken(response)).toBeNull()
        })

        it("recusa um login que não existe", async () => {
            let response = await client.anonymous().post("/Base/Users/login", { login: UsersFactory.buildEmail(), password: root.password })

            expect(response.status).toBe(401)
        })

        it("recusa senha em branco antes de chegar no banco", async () => {
            let response = await client.anonymous().post("/Base/Users/login", { login: root.user.Email, password: " " })

            expect(response.status).toBe(406)
        })
    })

    describe("GET /Base/Users/getSelf", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Base/Users/getSelf")

            expect(response.status).toBe(401)
        })

        it("recusa token inválido", async () => {
            let response = await new TestClient("token-invalido").get("/Base/Users/getSelf")

            expect(response.status).toBe(401)
        })

        it("devolve o usuário dono do token", async () => {
            let response = await client.get("/Base/Users/getSelf")

            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
                IdUser: root.user.IdUser,
                Name: "Usuário raiz",
                Email: root.user.Email,
                Phone: Number(root.user.Phone),
                Active: true,
            })
        })

        it("não devolve o hash da senha", async () => {
            let response = await client.get("/Base/Users/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.Password).toBeUndefined()
        })

        it("responde 406 quando o usuário do token não existe mais", async () => {
            let removed = await UsersFactory.create()
            await TestDatabase.connection().delete().from("Users").where("IdUser", removed.user.IdUser)

            let response = await new TestClient(removed.token).get("/Base/Users/getSelf")

            expect(response.status).toBe(406)
        })
    })

    describe("POST /Base/Users", () => {

        //  Rota pública: é por ela que nasce o primeiro usuário, sem token nenhum
        it("recusa corpo incompleto", async () => {
            let response = await client.anonymous().post("/Base/Users", { Name: "Sem o resto" })

            expect(response.status).toBe(406)
        })

        it("cria o usuário no banco sem exigir token", async () => {
            let payload = buildPayload({ Name: "Usuário criado pela rota" })

            let response = await client.anonymous().post("/Base/Users", payload)

            expect(response.status).toBe(200)

            let created = await findByEmail(payload.Email)

            expect(created).toBeDefined()
            expect(created?.Name).toBe(payload.Name)
            expect(created?.Active).toBe(true)
        })

        it("grava a senha com hash, nunca em texto puro", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Base/Users", payload)

            let created = await findByEmail(payload.Email)

            expect(created?.Password).not.toBe(payload.Password)
        })

        let IdWorkspace: number

        //  Todo dado de domínio é escopado por IdWorkspace: usuário sem workspace não
        //  consegue lançar nada, então os dois nascem na mesma transaction
        it("cria o workspace do usuário junto e devolve os dois ids", async () => {
            let payload = buildPayload({ Name: "Usuário com workspace" })

            let response = await client.anonymous().post("/Base/Users", payload)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                IdUser: expect.any(Number),
                IdWorkspace: expect.any(Number),
            })

            IdWorkspace = response.body.IdWorkspace

            let workspace = await findWorkspace(response.body.IdWorkspace)

            expect(workspace?.IdOwnerUser).toBe(response.body.IdUser)
            expect(workspace?.Name).toBe(payload.Name)
        })

        //  Se um usuário for criado já com um namespace, ele não deve criar um novo
        it("cria o usuário e adicionar ele a um workspace já existente", async () => {

            let payload = buildPayload({ IdWorkspace, Name: "Usuário com workspace" })

            let response = await client.anonymous().post("/Base/Users", payload)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                IdUser: expect.any(Number),
                IdWorkspace: expect.any(Number),
            })
            
            expect(response.body.IdWorkspace).toEqual(IdWorkspace)
        })

        //  Sem a matrícula o workspace é órfão: as leituras saem de WorkspaceMembers
        it("matricula o dono no workspace criado", async () => {
            let response = await client.anonymous().post("/Base/Users", buildPayload())

            let membership = await TestDatabase.connection()
                .select("*")
                .from("WorkspaceMembers")
                .where("IdWorkspace", response.body.IdWorkspace)
                .first()

            expect(membership?.IdUser).toBe(response.body.IdUser)
            expect(membership?.Role).toBe("owner")
        })

        //  O índice único de Email já barraria, mas com 500: a resposta tem que dizer o motivo
        it("recusa um e-mail que já existe", async () => {
            let payload = buildPayload()

            expect((await client.anonymous().post("/Base/Users", payload)).status).toBe(200)

            let response = await client.anonymous().post("/Base/Users", { ...payload, Name: "Outro nome" })

            expect(response.status).toBe(406)
        })

        //  O validateLogin normaliza o login para minúsculo: gravar o e-mail como veio
        //  deixaria quem se cadastrou com maiúscula sem conseguir entrar
        it("normaliza o e-mail para minúsculo", async () => {
            let payload = buildPayload()
            let Email = payload.Email.toUpperCase()

            expect((await client.anonymous().post("/Base/Users", { ...payload, Email })).status).toBe(200)

            expect(await findByEmail(payload.Email)).toBeDefined()

            //  E o login com a caixa original continua funcionando
            expect((await client.anonymous().login(Email, payload.Password)).status).toBe(200)
        })

        it("recusa um e-mail malformado", async () => {
            let response = await client.anonymous().post("/Base/Users", buildPayload({ Email: "nao-e-um-email" }))

            expect(response.status).toBe(406)
        })

        //  Se o workspace falhasse, um usuário pela metade ficaria gravado
        it("não deixa usuário órfão quando o cadastro é recusado", async () => {
            let payload = buildPayload()

            await client.anonymous().post("/Base/Users", payload)
            await client.anonymous().post("/Base/Users", payload)

            let users = await TestDatabase.connection().select("*").from("Users").where("Email", payload.Email)

            expect(users).toHaveLength(1)
        })
    })

    describe("PUT /Base/Users/IdUser=:IdUser", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Base/Users/IdUser=${root.user.IdUser}`, buildUpdatePayload())

            expect(response.status).toBe(401)
        })

        it("recusa IdUser não numérico", async () => {
            let response = await client.put("/Base/Users/IdUser=abc", buildUpdatePayload())

            expect(response.status).toBe(406)
        })

        //  A senha não se troca por aqui: ela tem rota própria, que exige a senha atual
        it("recusa Password no corpo", async () => {
            let response = await client.put(`/Base/Users/IdUser=${root.user.IdUser}`, buildPayload())

            expect(response.status).toBe(406)
        })

        it("atualiza os dados e o UpdatedAt", async () => {
            let target = await UsersFactory.create()
            let payload = buildUpdatePayload({ Name: "Nome atualizado", Email: target.user.Email })

            let response = await client.put(`/Base/Users/IdUser=${target.user.IdUser}`, payload)

            expect(response.status).toBe(200)

            let updated = await findByEmail(target.user.Email)

            expect(updated?.Name).toBe("Nome atualizado")
            expect(new Date(updated!.UpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(target.user.UpdatedAt).getTime())
        })
    })

    describe("PUT /Base/Users/updatePassword", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put("/Base/Users/updatePassword", { oldPassword: root.password, newPassword: "NovaSenha@123" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem a nova senha", async () => {
            let response = await new TestClient(root.token).put("/Base/Users/updatePassword", { oldPassword: root.password })

            expect(response.status).toBe(406)
        })

        it("recusa quando a senha atual não confere", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).put("/Base/Users/updatePassword", { oldPassword: "não é essa", newPassword: "NovaSenha@123" })

            expect(response.status).toBe(406)

            //  A senha antiga continua valendo
            expect((await client.anonymous().login(owner.user.Email, owner.password)).status).toBe(200)
        })

        it("troca a senha do dono do token e permite logar com ela", async () => {
            let owner = await UsersFactory.create()
            let newPassword = "NovaSenha@123"

            let response = await new TestClient(owner.token).put("/Base/Users/updatePassword", { oldPassword: owner.password, newPassword })

            expect(response.status).toBe(200)

            let login = await client.anonymous().login(owner.user.Email, newPassword)

            expect(login.status).toBe(200)
        })

        it("guarda a nova senha com hash", async () => {
            let owner = await UsersFactory.create()
            let newPassword = "OutraSenha@456"

            await new TestClient(owner.token).put("/Base/Users/updatePassword", { oldPassword: owner.password, newPassword })

            let updated = await findByEmail(owner.user.Email)

            expect(updated?.Password).not.toBe(newPassword)
        })
    })

    //  O caminho completo do usuário, só com HTTP: nenhuma escrita direta no banco, nenhum token
    //  fabricado pela factory. É este describe que continua fazendo sentido quando a suíte roda
    //  com TEST_BASE_URL apontando para um servidor de verdade.
    describe("Fluxo end to end", () => {

        it("cadastra, autentica, consulta e troca a senha", async () => {
            let payload = buildPayload({ Name: "Usuário do fluxo" })

            expect((await new TestClient().post("/Base/Users", payload)).status).toBe(200)

            let created = new TestClient()
            let login = await created.login(payload.Email, payload.Password)

            expect(login.status).toBe(200)
            expect(created.getToken()).toBeTruthy()

            let self = await created.get("/Base/Users/getSelf")

            expect(self.status).toBe(200)
            expect(self.body.Email).toBe(payload.Email)

            let newPassword = "SenhaDoFluxo@456"

            expect((await created.put("/Base/Users/updatePassword", { oldPassword: payload.Password, newPassword })).status).toBe(200)
            expect((await new TestClient().login(payload.Email, newPassword)).status).toBe(200)
            expect((await new TestClient().login(payload.Email, payload.Password)).status).toBe(401)
        })
    })
})

//  Corpo do cadastro: com senha
function buildPayload(overrides: Partial<UsersNamespace.CreateUserPayload> = {}): UsersNamespace.CreateUserPayload {
    return {
        Name: "Usuário de teste",
        Email: UsersFactory.buildEmail(),
        Password: "Senha@123",
        Phone: 549987654321,
        ...overrides,
    }
}

//  Corpo do update: sem senha, que só se troca pela rota dedicada
function buildUpdatePayload(overrides: Partial<UsersNamespace.UpdateUserPayload> = {}): UsersNamespace.UpdateUserPayload {
    let { Password, ...payload } = buildPayload()

    return { ...payload, ...overrides }
}

function findByEmail(Email: string) {
    return TestDatabase.connection().select("*").from("Users").where("Email", Email).first()
}

function findWorkspace(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}
