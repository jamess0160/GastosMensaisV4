import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados da feature Workspaces. Um describe por rota de Workspaces.route.ts.
//
//  O workspace não tem rota de criação: ele nasce dentro do POST /Base/Users, na mesma
//  transaction. É o describe do fluxo end to end que cobre esse nascimento, por HTTP.

describe("Workspaces", () => {

    let root: TestUser
    let client: TestClient

    beforeAll(async () => {
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono do workspace" })
        client = new TestClient(root.token)
    })

    describe("GET /Base/Workspaces/getSelf", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get("/Base/Workspaces/getSelf")

            expect(response.status).toBe(401)
        })

        it("devolve o workspace do usuário do token", async () => {
            let response = await client.get("/Base/Workspaces/getSelf")

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

            let response = await new TestClient(other.token).get("/Base/Workspaces/getSelf")

            expect(response.status).toBe(200)
            expect(response.body.map((item: { IdWorkspace: number }) => item.IdWorkspace)).toEqual([other.workspace.IdWorkspace])
        })
    })

    describe("PUT /Base/Workspaces/IdWorkspace=:IdWorkspace", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Base/Workspaces/IdWorkspace=${root.workspace.IdWorkspace}`, { Name: "Novo nome" })

            expect(response.status).toBe(401)
        })

        it("recusa IdWorkspace não numérico", async () => {
            let response = await client.put("/Base/Workspaces/IdWorkspace=abc", { Name: "Novo nome" })

            expect(response.status).toBe(406)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.put(`/Base/Workspaces/IdWorkspace=${root.workspace.IdWorkspace}`, {})

            expect(response.status).toBe(406)
        })

        //  O IdWorkspace vem da URL, ou seja, do cliente: sem a checagem de matrícula
        //  qualquer usuário logado renomearia o tenant de qualquer outro
        it("recusa o workspace de outro usuário", async () => {
            let other = await UsersFactory.create()

            let response = await new TestClient(other.token).put(`/Base/Workspaces/IdWorkspace=${root.workspace.IdWorkspace}`, { Name: "Invadido" })

            expect(response.status).toBe(406)

            let unchanged = await findById(root.workspace.IdWorkspace)

            expect(unchanged?.Name).not.toBe("Invadido")
        })

        it("renomeia o workspace do dono e atualiza o UpdatedAt", async () => {
            let owner = await UsersFactory.create()

            let response = await new TestClient(owner.token).put(`/Base/Workspaces/IdWorkspace=${owner.workspace.IdWorkspace}`, { Name: "Finanças da casa" })

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

            let created = await new TestClient().post("/Base/Users", payload)

            expect(created.status).toBe(200)
            expect(created.body.IdUser).toEqual(expect.any(Number))
            expect(created.body.IdWorkspace).toEqual(expect.any(Number))

            let client = new TestClient()

            expect((await client.login(payload.Email, payload.Password)).status).toBe(200)

            let self = await client.get("/Base/Workspaces/getSelf")

            expect(self.status).toBe(200)
            expect(self.body).toHaveLength(1)
            expect(self.body[0].IdWorkspace).toBe(created.body.IdWorkspace)
            //  O workspace herda o nome do dono no cadastro
            expect(self.body[0].Name).toBe(payload.Name)

            expect((await client.put(`/Base/Workspaces/IdWorkspace=${created.body.IdWorkspace}`, { Name: "Meu orçamento" })).status).toBe(200)

            let renamed = await client.get("/Base/Workspaces/getSelf")

            expect(renamed.body[0].Name).toBe("Meu orçamento")
        })
    })
})

function findById(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Workspaces").where("IdWorkspace", IdWorkspace).first()
}
