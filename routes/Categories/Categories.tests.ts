import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Categories. Um describe por rota de Categories.route.ts, mais o fluxo
//  end to end no fim.
//
//  O que é próprio desta feature, e o que mais aparece aqui: metade das linhas da tabela não é
//  de ninguém. A categoria global (IdWorkspace nulo) é a mesma linha para todos os workspaces,
//  então todo describe de escrita tem o caso dela — editar ou arquivar uma global mexeria no
//  cadastro de toda a base, e é a falha que o caminho feliz nunca encontra.
//
//  A lista é plana: não há categoria filha de outra.

describe("Categories", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient
    let globalCategory: { IdCategory: number, Description: string }

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces e, por tabela, as Categories junto — inclusive
        //  as globais que a migration de seed inseriu, que não têm workspace mas moram na mesma
        //  tabela. Por isso a suíte semeia a sua própria global em vez de contar com o seed:
        //  qualquer outra suíte que trunque antes desta levaria as 13 embora.
        await TestDatabase.truncate(["Users"])

        globalCategory = await seedGlobalCategory({ Description: "Transporte", Position: 1 })

        root = await UsersFactory.create({ Name: "Dono das categorias" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Base/Categories", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Base/Categories`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Base/Categories`)

            expect(response.status).toBe(406)
        })

        //  O token é assinado de verdade — foi esta API que o emitiu — mas aponta para um
        //  workspace do qual o usuário não é membro. Só a consulta à matrícula pega isso.
        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Base/Categories`)

            expect(response.status).toBe(406)
        })

        //  Workspace recém-criado não tem categoria nenhuma: as globais são as únicas que
        //  existem, e é com elas que o usuário lança o primeiro gasto.
        it("devolve as globais mesmo com o workspace vazio", async () => {
            let user = await UsersFactory.create()

            let response = await new TestClient(user.token).get(`/Base/Categories`)

            expect(response.status).toBe(200)
            expect(response.body.map(description)).toEqual(["Transporte"])
            //  IdWorkspace nulo é como o cliente sabe que aquela linha não abre para edição
            expect(response.body[0].IdWorkspace).toBeNull()
        })

        //  Juntas numa lista só: separá-las obrigaria o cliente a concatenar duas chamadas
        //  para montar um seletor
        it("devolve as próprias junto com as globais", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Base/Categories`, { Description: "Faculdade" })

            let response = await workspaceClient.get(`/Base/Categories`)

            expect(response.status).toBe(200)
            expect(response.body.map(description).sort()).toEqual(["Faculdade", "Transporte"])
        })

        it("não devolve a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            await new TestClient(owner.token).post(`/Base/Categories`, { Description: "Segredo do vizinho" })

            let response = await new TestClient((await UsersFactory.create()).token).get(`/Base/Categories`)

            expect(response.body.map(description)).not.toContain("Segredo do vizinho")
        })

        it("não devolve categoria arquivada", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let archived = await workspaceClient.post(`/Base/Categories`, { Description: "Categoria arquivada" })

            await workspaceClient.delete(`/Base/Categories/IdCategory=${archived.body.IdCategory}`)

            let response = await workspaceClient.get(`/Base/Categories`)

            expect(response.body.map(description)).toEqual(["Transporte"])
        })
    })

    describe("POST /Base/Categories", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Base/Categories`, { Description: "Categoria" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem a Description", async () => {
            let response = await client.post(`/Base/Categories`, {})

            expect(response.status).toBe(406)
        })

        it("recusa cor fora do formato #RRGGBB", async () => {
            let response = await client.post(`/Base/Categories`, { Description: "Categoria", Color: "roxo" })

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await UsersFactory.create()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.workspace.IdWorkspace))

            let response = await forged.post(`/Base/Categories`, { Description: "Invasora" })

            expect(response.status).toBe(406)
            expect(await findCategories(owner.workspace.IdWorkspace)).toHaveLength(0)
        })

        it("cria a categoria do workspace", async () => {
            let user = await UsersFactory.create()

            let response = await new TestClient(user.token).post(`/Base/Categories`, {
                Description: "Academia",
                IconKey: "dumbbell",
                Color: "#2E7D32",
                Position: 4,
            })

            expect(response.status).toBe(200)
            expect(response.body.IdCategory).toEqual(expect.any(Number))

            let [category] = await findCategories(user.workspace.IdWorkspace)

            expect(category).toMatchObject({
                Description: "Academia",
                IconKey: "dumbbell",
                Color: "#2E7D32",
                Position: 4,
                //  Do workspace, nunca global: a rota não tem como criar uma linha sem dono
                IdWorkspace: user.workspace.IdWorkspace,
                Active: true,
            })
        })
    })

    describe("PUT /Base/Categories/IdCategory=:IdCategory", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Base/Categories/IdCategory=1`, { Description: "X" })

            expect(response.status).toBe(401)
        })

        it("recusa categoria inexistente", async () => {
            let response = await client.put(`/Base/Categories/IdCategory=999999`, { Description: "X" })

            expect(response.status).toBe(406)
        })

        it("recusa a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Base/Categories`, { Description: "Categoria do dono" })

            let response = await otherClient.put(`/Base/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Invadida" })

            expect(response.status).toBe(406)
            expect((await findCategoryById(created.body.IdCategory)).Description).toBe("Categoria do dono")
        })

        //  **O teste que sustenta o CategoryOwnership.** A global é visível a todos os
        //  workspaces, então ela chega no getUnique de qualquer sessão. Sem esta trava, um PUT
        //  renomeia a categoria de toda a base de uma vez.
        it("recusa editar categoria global", async () => {
            let response = await client.put(`/Base/Categories/IdCategory=${globalCategory.IdCategory}`, { Description: "Sequestrada" })

            expect(response.status).toBe(406)
            expect((await findCategoryById(globalCategory.IdCategory)).Description).toBe("Transporte")
        })

        it("edita descrição, cor, ícone e posição", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Base/Categories`, { Description: "Casa", Color: "#000000" })

            let response = await workspaceClient.put(`/Base/Categories/IdCategory=${created.body.IdCategory}`, {
                Description: "Moradia",
                Color: "#5D4037",
                IconKey: "home",
                Position: 2,
            })

            expect(response.status).toBe(200)
            expect(await findCategoryById(created.body.IdCategory)).toMatchObject({
                Description: "Moradia",
                Color: "#5D4037",
                IconKey: "home",
                Position: 2,
            })
        })

        //  Edição parcial: o PUT que só renomeia não pode apagar o resto por omissão
        it("não apaga os campos que o corpo não traz", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Base/Categories`, { Description: "Casa", Color: "#123456", IconKey: "home" })

            await workspaceClient.put(`/Base/Categories/IdCategory=${created.body.IdCategory}`, { Description: "Só a descrição" })

            expect(await findCategoryById(created.body.IdCategory)).toMatchObject({
                Description: "Só a descrição",
                Color: "#123456",
                IconKey: "home",
            })
        })
    })

    describe("DELETE /Base/Categories/IdCategory=:IdCategory", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Base/Categories/IdCategory=1`)

            expect(response.status).toBe(401)
        })

        it("recusa categoria inexistente", async () => {
            let response = await client.delete(`/Base/Categories/IdCategory=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Base/Categories`, { Description: "Categoria do dono" })

            let response = await otherClient.delete(`/Base/Categories/IdCategory=${created.body.IdCategory}`)

            expect(response.status).toBe(406)
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(true)
        })

        //  Arquivar a global a tiraria da lista de todos os workspaces de uma vez
        it("recusa arquivar categoria global", async () => {
            let response = await client.delete(`/Base/Categories/IdCategory=${globalCategory.IdCategory}`)

            expect(response.status).toBe(406)
            expect((await findCategoryById(globalCategory.IdCategory)).Active).toBe(true)
        })

        //  Soft delete e não delete físico: Expenses aponta para cá, e o gasto de março tem
        //  que continuar apontando para a categoria em que foi lançado.
        it("arquiva sem apagar a linha, e só ela", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Base/Categories`, { Description: "Categoria antiga" })
            let untouched = await workspaceClient.post(`/Base/Categories`, { Description: "Categoria viva" })

            let response = await workspaceClient.delete(`/Base/Categories/IdCategory=${created.body.IdCategory}`)

            expect(response.status).toBe(200)

            //  A linha continua no banco: só saiu das listas
            expect((await findCategoryById(created.body.IdCategory)).Active).toBe(false)
            expect((await findCategoryById(untouched.body.IdCategory)).Active).toBe(true)
            expect((await findCategoryById(globalCategory.IdCategory)).Active).toBe(true)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passo 4 do "como saber que a leva acabou" do ROADMAP, só por HTTP: cria a categoria
        //  própria e a lê junto com as globais
        it("cadastra o usuário, cria a categoria própria e lista junto com as globais", async () => {
            let payload = {
                Name: "Usuário do fluxo de categorias",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Base/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            //  Antes de cadastrar nada, o usuário já tem com o que lançar um gasto
            let predefined = await flowClient.get(`/Base/Categories`)

            expect(predefined.status).toBe(200)
            expect(predefined.body.map(description)).toEqual(["Transporte"])

            let own = await flowClient.post(`/Base/Categories`, { Description: "Faculdade", Color: "#283593" })

            expect(own.status).toBe(200)

            let list = await flowClient.get(`/Base/Categories`)

            expect(list.body.map(description).sort()).toEqual(["Faculdade", "Transporte"])
            expect(list.body.find((item: { Description: string }) => item.Description === "Faculdade")).toMatchObject({ Color: "#283593" })

            //  A global não é dele para editar, mesmo aparecendo na mesma lista
            expect((await flowClient.put(`/Base/Categories/IdCategory=${globalCategory.IdCategory}`, { Description: "Minha" })).status).toBe(406)

            //  Arquivar a própria não encosta na global
            expect((await flowClient.delete(`/Base/Categories/IdCategory=${own.body.IdCategory}`)).status).toBe(200)

            let final = await flowClient.get(`/Base/Categories`)

            expect(final.body.map(description)).toEqual(["Transporte"])
        })
    })
})

function description(item: { Description: string }) {
    return item.Description
}

function findCategories(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Categories").where("IdWorkspace", IdWorkspace).where("Active", true).orderBy("IdCategory")
}

function findCategoryById(IdCategory: number) {
    return TestDatabase.connection().select("*").from("Categories").where("IdCategory", IdCategory).first()
}

//  A global não nasce por rota nenhuma — é a migration de seed que a insere, e o truncate do
//  beforeAll a leva junto. Semear aqui deixa a suíte independente da ordem de execução.
async function seedGlobalCategory(overrides: { Description: string, Position?: number }) {
    let [category] = await TestDatabase.connection()
        .insert({ IdWorkspace: null, IconKey: "car", Color: "#1565C0", ...overrides })
        .into("Categories")
        .returning("*") as Array<{ IdCategory: number, Description: string }>

    return category
}
