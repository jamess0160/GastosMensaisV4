import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados da feature Workspaces. Um describe por rota de Workspaces.route.ts.
//
//  O workspace não tem rota de criação: ele nasce dentro do POST /Users, na mesma
//  transaction. É o describe do fluxo end to end que cobre esse nascimento, por HTTP.

describe("Workspaces", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono do workspace" })
        client = new TestClient(root.token)
    })

    describe("GET /Workspaces/getSelf", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Workspaces/getSelf")

            expect(response.status).toBe(401)
        })

        it("devolve o workspace do usuário do token", async () => {
            let response = await client.get("/Workspaces/getSelf")

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                IdWorkspace: root.workspace.IdWorkspace,
                IdOwnerUser: root.user.IdUser,
            })
        })

        //  A leitura sai de WorkspaceMembers: quem não é membro não enxerga o tenant
        it("não devolve o workspace de outro usuário", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(other.token).get("/Workspaces/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.map((item: { IdWorkspace: number }) => item.IdWorkspace)).toEqual([other.workspace.IdWorkspace])
        })
    })

    describe("POST /Workspaces/switch", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post("/Workspaces/switch", { IdWorkspace: root.workspace.IdWorkspace })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o IdWorkspace", async () => {
            let response = await client.post("/Workspaces/switch", {})

            expect(response.status).toBe(406)
        })

        it("recusa workspace inexistente", async () => {
            let response = await client.post("/Workspaces/switch", { IdWorkspace: 999999 })

            expect(response.status).toBe(406)
        })

        //  É a única rota que recebe um IdWorkspace escrito pelo cliente, e o que sai daqui
        //  vira token assinado: se ela não conferisse a matrícula, todas as rotas seguintes
        //  aceitariam esse token como legítimo — porque, para elas, ele é
        it("recusa o workspace de um usuário que não é membro", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(other.token).post("/Workspaces/switch", {
                IdWorkspace: root.workspace.IdWorkspace,
            })

            expect(response.status).toBe(406)
            //  E não emitiu token nenhum
            expect(TestClient.extractCookieToken(response)).toBeNull()
        })

        it("seleciona o workspace do membro e reemite o token com ele dentro", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).post("/Workspaces/switch", {
                IdWorkspace: owner.workspace.IdWorkspace,
            })

            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
                IdWorkspace: owner.workspace.IdWorkspace,
                IdOwnerUser: owner.user.IdUser,
            })

            let token = TestClient.extractCookieToken(response)

            expect(token).toBeTruthy()
            expect(TestClient.decodeToken(token!)).toMatchObject({
                id: owner.user.IdUser,
                IdWorkspace: owner.workspace.IdWorkspace,
            })
        })

        //  O token é credencial: não pode ficar ao alcance de script na tela
        it("reemite o token como httpOnly", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).post("/Workspaces/switch", {
                IdWorkspace: owner.workspace.IdWorkspace,
            })

            let raw: string[] = response.headers["set-cookie"] ?? []

            expect(raw.find((cookie) => cookie.startsWith("token="))).toContain("HttpOnly")
        })

        //  Fecha o ciclo: a sessão que não tinha workspace passa a ter, e uma rota de tenant
        //  que respondia 406 passa a responder — com o token novo que o switch devolveu
        it("destrava as rotas de tenant para a sessão que não tinha workspace", async () => {
            let owner = await UsersFactory.create()
            let ownerClient = new TestClient(UsersFactory.buildToken(owner.user.IdUser))

            expect((await ownerClient.get("/Accounts")).status).toBe(406)

            let switched = await ownerClient.post("/Workspaces/switch", { IdWorkspace: owner.workspace.IdWorkspace })

            expect(switched.status).toBe(200)

            ownerClient.setToken(TestClient.extractCookieToken(switched))

            expect((await ownerClient.get("/Accounts")).status).toBe(200)
        })
    })

    describe("PUT /Workspaces", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Workspaces`, { Name: "Novo nome" })

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).put(`/Workspaces`, { Name: "Novo nome" })

            expect(response.status).toBe(406)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.put(`/Workspaces`, {})

            expect(response.status).toBe(406)
        })

        //  Token assinado pela própria API, mas apontando para um workspace de que o usuário
        //  não é membro. A assinatura sozinha não pega isso — quem pega é o assertRole
        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace)).put(`/Workspaces`, { Name: "Invadido" })

            expect(response.status).toBe(406)

            let unchanged = await findById(root.workspace.IdWorkspace)

            expect(unchanged?.Name).not.toBe("Invadido")
        })

        it("renomeia o workspace do dono e atualiza o UpdatedAt", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).put(`/Workspaces`, { Name: "Finanças da casa" })

            expect(response.status).toBe(200)

            let updated = await findById(owner.workspace.IdWorkspace)

            expect(updated?.Name).toBe("Finanças da casa")
            expect(new Date(updated!.UpdatedAt).getTime()).toBeGreaterThanOrEqual(new Date(owner.workspace.UpdatedAt).getTime())
        })
    })

    describe("Fluxo end to end", () => {

        it("o cadastro cria o workspace e o dono já o enxerga", async () => {
            let payload = {
                Name: "Usuário do fluxo",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            let created = await new TestClient().post("/Users", payload)

            expect(created.status).toBe(200)
            expect(created.body.IdUser).toEqual(expect.any(Number))
            expect(created.body.IdWorkspace).toEqual(expect.any(Number))

            let client = new TestClient()

            let logged = await client.login(payload.Email, payload.Password)

            expect(logged.status).toBe(200)

            //  O login já sai com um workspace selecionado (AcessControl.startSession →
            //  SelectDefault): sem isso toda rota de tenant responderia 406 até o cliente
            //  chamar o switch — um passo obrigatório depois de todo login.
            //
            //  A seleção viaja dentro do próprio token, e não num cookie à parte: assim o
            //  cliente não consegue reescrevê-la, e a sessão inteira cabe num cookie só.
            expect(TestClient.decodeToken(client.getToken()!)).toMatchObject({
                id: created.body.IdUser,
                IdWorkspace: created.body.IdWorkspace,
            })

            let self = await client.get("/Workspaces/getSelf")

            expect(self.status).toBe(200)
            expect(self.body).toHaveLength(1)
            expect(self.body[0].IdWorkspace).toBe(created.body.IdWorkspace)
            //  O workspace herda o nome do dono no cadastro
            expect(self.body[0].Name).toBe(payload.Name)

            expect((await client.put(`/Workspaces`, { Name: "Meu orçamento" })).status).toBe(200)

            let renamed = await client.get("/Workspaces/getSelf")

            expect(renamed.body[0].Name).toBe("Meu orçamento")
        })
    })
})

function findById(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}
