import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Persons. Um describe por rota de Persons.route.ts, mais o fluxo end to
//  end no fim.
//
//  Duas coisas são próprias desta feature e aparecem em quase todo describe: o nome é único no
//  workspace **contando a pessoa arquivada**, e o IdUser é o vínculo com um login — único no
//  banco inteiro, escrito só pelo cadastro do usuário e nunca pelo cliente.

describe("Persons", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces e Persons junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono das pessoas" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Persons", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Persons`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Persons`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Persons`)

            expect(response.status).toBe(406)
        })

        //  Nunca vazia: o cadastro do usuário cria a pessoa dele junto, senão o dono não
        //  conseguiria entrar no próprio rateio
        it("devolve a pessoa do próprio dono, criada no cadastro", async () => {
            let user = await UsersFactory.create({ Name: "Dono sozinho" })

            let response = await new TestClient(user.token).get(`/Persons`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({ Name: "Dono sozinho", IdUser: user.user.IdUser })
        })

        it("devolve as pessoas do workspace em ordem de nome", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Persons`, { Name: "Zeca" })
            await workspaceClient.post(`/Persons`, { Name: "Ana" })

            let response = await workspaceClient.get(`/Persons`)

            expect(response.body.map((item: { Name: string }) => item.Name)).toEqual(["Ana", "Dono", "Zeca"])
            //  Pessoa sem login: é para isso que a tabela existe
            expect(response.body[0].IdUser).toBeNull()
        })

        it("não devolve pessoa arquivada nem a de outro workspace", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            let archived = await workspaceClient.post(`/Persons`, { Name: "Arquivada" })

            await workspaceClient.delete(`/Persons/IdPerson=${archived.body.IdPerson}`)

            let response = await workspaceClient.get(`/Persons`)

            expect(response.body.map((item: { Name: string }) => item.Name)).toEqual(["Dono"])
        })
    })

    describe("POST /Persons", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Persons`, { Name: "Pessoa" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.post(`/Persons`, {})

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await UsersFactory.create()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.workspace.IdWorkspace))

            let response = await forged.post(`/Persons`, { Name: "Invasora" })

            expect(response.status).toBe(406)
            //  Só a do dono, que veio do cadastro
            expect(await findPersons(owner.workspace.IdWorkspace)).toHaveLength(1)
        })

        it("cadastra a pessoa sem login", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })

            let response = await new TestClient(user.token).post(`/Persons`, { Name: "Filho" })

            expect(response.status).toBe(200)
            expect(response.body.IdPerson).toEqual(expect.any(Number))

            let person = await findPersonById(response.body.IdPerson)

            expect(person).toMatchObject({
                Name: "Filho",
                IdWorkspace: user.workspace.IdWorkspace,
                //  Pessoa não precisa de conta no sistema para entrar num rateio
                IdUser: null,
                Active: true,
            })
        })

        //  O IdUser é unique no banco inteiro, não por workspace: aceitá-lo do cliente deixaria
        //  chutar um id sequencial e consumir para sempre a vaga de Person daquele usuário
        it("recusa o IdUser no corpo", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })

            let response = await new TestClient(user.token).post(`/Persons`, { Name: "Sequestro", IdUser: other.user.IdUser })

            //  O schema é fechado: campo desconhecido é corpo inválido, não campo ignorado
            expect(response.status).toBe(406)
        })

        //  O índice unique(IdWorkspace, Name) já barraria, mas com 500
        it("recusa nome repetido no mesmo workspace", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            expect((await workspaceClient.post(`/Persons`, { Name: "Maria" })).status).toBe(200)

            let response = await workspaceClient.post(`/Persons`, { Name: "Maria" })

            expect(response.status).toBe(406)
        })

        //  "Maria" e "maria" no mesmo rateio são erro de digitação, não duas pessoas. A
        //  conferência é mais estrita que o índice de propósito.
        it("recusa nome repetido só trocando a caixa", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Persons`, { Name: "Maria" })

            let response = await workspaceClient.post(`/Persons`, { Name: "MARIA" })

            expect(response.status).toBe(406)
        })

        //  O índice não conhece o Active: sem enxergar a arquivada, a inserção estouraria 500
        it("recusa nome ocupado por pessoa arquivada", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Persons`, { Name: "Maria" })

            await workspaceClient.delete(`/Persons/IdPerson=${created.body.IdPerson}`)

            let response = await workspaceClient.post(`/Persons`, { Name: "Maria" })

            expect(response.status).toBe(406)
        })

        //  O nome é único por workspace, não global
        it("aceita o mesmo nome em workspaces diferentes", async () => {
            let first = await UsersFactory.create({ Name: "Dono um" })
            let second = await UsersFactory.create({ Name: "Dono dois" })

            expect((await new TestClient(first.token).post(`/Persons`, { Name: "Maria" })).status).toBe(200)
            expect((await new TestClient(second.token).post(`/Persons`, { Name: "Maria" })).status).toBe(200)
        })
    })

    describe("PUT /Persons/IdPerson=:IdPerson", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Persons/IdPerson=1`, { Name: "X" })

            expect(response.status).toBe(401)
        })

        it("recusa pessoa inexistente", async () => {
            let response = await client.put(`/Persons/IdPerson=999999`, { Name: "X" })

            expect(response.status).toBe(406)
        })

        //  O IdPerson é sequencial: sem o filtro de workspace no getUnique, a matrícula
        //  conferida no próprio tenant liberaria a edição da pessoa do vizinho
        it("recusa a pessoa de outro workspace", async () => {
            let owner = await UsersFactory.create({ Name: "Dono" })
            let created = await new TestClient(owner.token).post(`/Persons`, { Name: "Pessoa do dono" })

            let response = await otherClient.put(`/Persons/IdPerson=${created.body.IdPerson}`, { Name: "Invadida" })

            expect(response.status).toBe(406)
            expect((await findPersonById(created.body.IdPerson)).Name).toBe("Pessoa do dono")
        })

        it("renomeia a pessoa", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Persons`, { Name: "Fulano" })

            let response = await workspaceClient.put(`/Persons/IdPerson=${created.body.IdPerson}`, { Name: "Fulano de Tal" })

            expect(response.status).toBe(200)
            expect((await findPersonById(created.body.IdPerson)).Name).toBe("Fulano de Tal")
        })

        it("recusa renomear para um nome já usado", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Persons`, { Name: "Ana" })
            let created = await workspaceClient.post(`/Persons`, { Name: "Bia" })

            let response = await workspaceClient.put(`/Persons/IdPerson=${created.body.IdPerson}`, { Name: "Ana" })

            expect(response.status).toBe(406)
            expect((await findPersonById(created.body.IdPerson)).Name).toBe("Bia")
        })

        //  Reenviar o próprio nome não é conflito consigo mesma: o cliente que devolve o
        //  objeto inteiro no PUT não pode ser barrado por isso
        it("aceita salvar mantendo o próprio nome", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Persons`, { Name: "Ana" })

            let response = await workspaceClient.put(`/Persons/IdPerson=${created.body.IdPerson}`, { Name: "Ana" })

            expect(response.status).toBe(200)
        })

        //  Renomear quem tem login é normal — o que não se faz é apontar a pessoa para outro
        it("renomeia a pessoa do dono sem tocar no vínculo", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })

            let response = await new TestClient(user.token).put(`/Persons/IdPerson=${user.person.IdPerson}`, { Name: "Dono renomeado" })

            expect(response.status).toBe(200)
            expect(await findPersonById(user.person.IdPerson)).toMatchObject({
                Name: "Dono renomeado",
                IdUser: user.user.IdUser,
            })
        })
    })

    describe("DELETE /Persons/IdPerson=:IdPerson", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Persons/IdPerson=1`)

            expect(response.status).toBe(401)
        })

        it("recusa pessoa inexistente", async () => {
            let response = await client.delete(`/Persons/IdPerson=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa a pessoa de outro workspace", async () => {
            let owner = await UsersFactory.create({ Name: "Dono" })
            let created = await new TestClient(owner.token).post(`/Persons`, { Name: "Pessoa do dono" })

            let response = await otherClient.delete(`/Persons/IdPerson=${created.body.IdPerson}`)

            expect(response.status).toBe(406)
            expect((await findPersonById(created.body.IdPerson)).Active).toBe(true)
        })

        //  Soft delete: ExpensePersons e InflowPersons apontam para cá com ON DELETE RESTRICT,
        //  e o rateio de março tem que continuar apontando para quem entrou nele
        it("arquiva a pessoa sem apagar a linha", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Persons`, { Name: "Ex-colega" })

            let response = await workspaceClient.delete(`/Persons/IdPerson=${created.body.IdPerson}`)

            expect(response.status).toBe(200)

            let person = await findPersonById(created.body.IdPerson)

            expect(person).toBeDefined()
            expect(person.Active).toBe(false)
        })

        //  **Arquivar a pessoa vinculada a um login é irreversível:** o IdUser é unique no banco
        //  inteiro e só o cadastro o escreve, então uma pessoa nova criada no lugar nasceria sem
        //  vínculo e o usuário ficaria fora de qualquer rateio futuro
        it("recusa arquivar a pessoa vinculada a um usuário", async () => {
            let user = await UsersFactory.create({ Name: "Dono" })

            let response = await new TestClient(user.token).delete(`/Persons/IdPerson=${user.person.IdPerson}`)

            expect(response.status).toBe(406)
            expect((await findPersonById(user.person.IdPerson)).Active).toBe(true)
        })
    })

    describe("Fluxo end to end", () => {

        //  Do cadastro até a lista de rateio pronta, só por HTTP: o dono já é pessoa, e as
        //  outras entram sem precisar de login nenhum
        it("cadastra o usuário, monta a lista de pessoas e arquiva uma", async () => {
            let payload = {
                Name: "Usuário do fluxo de pessoas",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            //  O dono já é pessoa antes de cadastrar qualquer coisa
            let initial = await flowClient.get(`/Persons`)

            expect(initial.status).toBe(200)
            expect(initial.body).toHaveLength(1)
            expect(initial.body[0].Name).toBe(payload.Name)

            let child = await flowClient.post(`/Persons`, { Name: "Filha" })
            let partner = await flowClient.post(`/Persons`, { Name: "Cônjuge" })

            expect(child.status).toBe(200)
            expect(partner.status).toBe(200)

            //  Nome repetido não passa: o rateio ficaria ilegível
            expect((await flowClient.post(`/Persons`, { Name: "Filha" })).status).toBe(406)

            let list = await flowClient.get(`/Persons`)

            expect(list.body).toHaveLength(3)
            //  Só o dono tem login; as outras duas existem só para o rateio
            expect(list.body.filter((item: { IdUser: number | null }) => item.IdUser !== null)).toHaveLength(1)

            //  A pessoa do próprio dono não é arquivável
            expect((await flowClient.delete(`/Persons/IdPerson=${initial.body[0].IdPerson}`)).status).toBe(406)

            expect((await flowClient.delete(`/Persons/IdPerson=${partner.body.IdPerson}`)).status).toBe(200)

            let final = await flowClient.get(`/Persons`)

            expect(final.body.map((item: { Name: string }) => item.Name)).toEqual(["Filha", payload.Name])
        })
    })
})

function findPersons(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Persons").where("IdWorkspace", IdWorkspace).where("Active", true).orderBy("IdPerson")
}

function findPersonById(IdPerson: number) {
    return TestDatabase.connection().select("*").from("Persons").where("IdPerson", IdPerson).first()
}
