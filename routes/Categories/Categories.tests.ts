import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Categories. Um describe por rota de Categories.route.ts, mais o fluxo
//  end to end no fim.
//
//  O que é próprio desta feature, e o que mais aparece aqui: metade das linhas da tabela não é
//  de ninguém. A categoria global (IdWorkspace nulo) é a mesma linha para todos os workspaces,
//  então todo describe de escrita tem o caso dela — editar ou arquivar uma global mexeria no
//  cadastro de toda a base, e é a falha que o caminho feliz nunca encontra.

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
            expect(response.body.map((item: { Description: string }) => item.Description)).toEqual(["Transporte"])
            //  IdWorkspace nulo é como o cliente sabe que aquela linha não abre para edição
            expect(response.body[0].IdWorkspace).toBeNull()
        })

        it("devolve as próprias junto com as globais, em árvore", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            //  Subcategoria própria pendurada numa global: é o caso comum — "Uber" dentro de
            //  "Transporte", que o usuário não cadastrou.
            await workspaceClient.post(`/Base/Categories`, { Description: "Uber", IdParentCategory: globalCategory.IdCategory })

            let own = await workspaceClient.post(`/Base/Categories`, { Description: "Faculdade" })
            await workspaceClient.post(`/Base/Categories`, { Description: "Mensalidade", IdParentCategory: own.body.IdCategory })

            let response = await workspaceClient.get(`/Base/Categories`)

            expect(response.status).toBe(200)

            let tree = byDescription(response.body)

            //  Só as raízes no topo: a subcategoria aparece dentro do pai, não solta
            expect(Object.keys(tree).sort()).toEqual(["Faculdade", "Transporte"])
            expect(tree["Transporte"].TreeItems.map((item: { Description: string }) => item.Description)).toEqual(["Uber"])
            expect(tree["Faculdade"].TreeItems.map((item: { Description: string }) => item.Description)).toEqual(["Mensalidade"])
        })

        it("não devolve a categoria de outro workspace", async () => {
            let owner = await UsersFactory.create()
            await new TestClient(owner.token).post(`/Base/Categories`, { Description: "Segredo do vizinho" })

            let response = await new TestClient((await UsersFactory.create()).token).get(`/Base/Categories`)

            expect(response.body.map((item: { Description: string }) => item.Description)).not.toContain("Segredo do vizinho")
        })

        it("não devolve categoria arquivada", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let archived = await workspaceClient.post(`/Base/Categories`, { Description: "Categoria arquivada" })

            await workspaceClient.delete(`/Base/Categories/IdCategory=${archived.body.IdCategory}`)

            let response = await workspaceClient.get(`/Base/Categories`)

            expect(response.body.map((item: { Description: string }) => item.Description)).toEqual(["Transporte"])
        })

        //  A árvore é uma vista da lista plana: nada pode sumir na montagem. Com o pai fora da
        //  lista, o buildTree descartaria a filha — ela sumiria da tela continuando ativa no
        //  banco e aceita como categoria de um gasto novo. O DELETE arquiva a subárvore junto,
        //  então aqui o estado é arranjado direto no banco.
        it("sobe para a raiz a categoria cujo pai saiu da lista", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let parent = await workspaceClient.post(`/Base/Categories`, { Description: "Pai sumido" })
            await workspaceClient.post(`/Base/Categories`, { Description: "Filha órfã", IdParentCategory: parent.body.IdCategory })

            await archiveDirectly(parent.body.IdCategory)

            let response = await workspaceClient.get(`/Base/Categories`)

            let tree = byDescription(response.body)

            expect(Object.keys(tree).sort()).toEqual(["Filha órfã", "Transporte"])
            //  A ligação continua gravada: o que mudou foi só onde ela é mostrada
            expect(tree["Filha órfã"].IdParentCategory).toBe(parent.body.IdCategory)
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

        it("recusa pai inexistente", async () => {
            let response = await client.post(`/Base/Categories`, { Description: "Órfã", IdParentCategory: 999999 })

            expect(response.status).toBe(406)
        })

        //  O IdParentCategory é sequencial e chega do cliente: sem a conferência dava para
        //  pendurar uma categoria própria dentro da árvore do vizinho.
        it("recusa pai de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let parent = await new TestClient(owner.token).post(`/Base/Categories`, { Description: "Pai do dono" })

            let response = await otherClient.post(`/Base/Categories`, { Description: "Invasora", IdParentCategory: parent.body.IdCategory })

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
                IdParentCategory: null,
                Active: true,
            })
        })

        it("cria subcategoria dentro de uma global", async () => {
            let user = await UsersFactory.create()

            let response = await new TestClient(user.token).post(`/Base/Categories`, {
                Description: "Uber",
                IdParentCategory: globalCategory.IdCategory,
            })

            expect(response.status).toBe(200)

            let [category] = await findCategories(user.workspace.IdWorkspace)

            //  A filha é do workspace; o pai continua sendo de todo mundo
            expect(category).toMatchObject({
                IdWorkspace: user.workspace.IdWorkspace,
                IdParentCategory: globalCategory.IdCategory,
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

        it("move a categoria para outro pai", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let parent = await workspaceClient.post(`/Base/Categories`, { Description: "Transporte próprio" })
            let child = await workspaceClient.post(`/Base/Categories`, { Description: "Uber" })

            let response = await workspaceClient.put(`/Base/Categories/IdCategory=${child.body.IdCategory}`, {
                Description: "Uber",
                IdParentCategory: parent.body.IdCategory,
            })

            expect(response.status).toBe(200)
            expect((await findCategoryById(child.body.IdCategory)).IdParentCategory).toBe(parent.body.IdCategory)
        })

        //  null é pedido; undefined é omissão. São coisas diferentes, e é por isso que a
        //  section olha `in body` em vez de truthy.
        it("promove a subcategoria a raiz com IdParentCategory null", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let parent = await workspaceClient.post(`/Base/Categories`, { Description: "Pai" })
            let child = await workspaceClient.post(`/Base/Categories`, { Description: "Filha", IdParentCategory: parent.body.IdCategory })

            let response = await workspaceClient.put(`/Base/Categories/IdCategory=${child.body.IdCategory}`, {
                Description: "Filha",
                IdParentCategory: null,
            })

            expect(response.status).toBe(200)
            expect((await findCategoryById(child.body.IdCategory)).IdParentCategory).toBeNull()
        })

        it("recusa a categoria como pai de si mesma", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Base/Categories`, { Description: "Sozinha" })

            let response = await workspaceClient.put(`/Base/Categories/IdCategory=${created.body.IdCategory}`, {
                Description: "Sozinha",
                IdParentCategory: created.body.IdCategory,
            })

            expect(response.status).toBe(406)
            expect((await findCategoryById(created.body.IdCategory)).IdParentCategory).toBeNull()
        })

        //  Ciclo indireto: pôr a avó dentro da neta deixaria os três nós sem raiz, e o ramo
        //  inteiro sumiria da árvore continuando lançável por id.
        it("recusa fechar ciclo com um descendente", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let grandparent = await workspaceClient.post(`/Base/Categories`, { Description: "Avó" })
            let parent = await workspaceClient.post(`/Base/Categories`, { Description: "Mãe", IdParentCategory: grandparent.body.IdCategory })
            let child = await workspaceClient.post(`/Base/Categories`, { Description: "Neta", IdParentCategory: parent.body.IdCategory })

            let response = await workspaceClient.put(`/Base/Categories/IdCategory=${grandparent.body.IdCategory}`, {
                Description: "Avó",
                IdParentCategory: child.body.IdCategory,
            })

            expect(response.status).toBe(406)
            expect((await findCategoryById(grandparent.body.IdCategory)).IdParentCategory).toBeNull()
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

        //  Arquivar a global a tiraria da lista de todos os workspaces da base
        it("recusa arquivar categoria global", async () => {
            let response = await client.delete(`/Base/Categories/IdCategory=${globalCategory.IdCategory}`)

            expect(response.status).toBe(406)
            expect((await findCategoryById(globalCategory.IdCategory)).Active).toBe(true)
        })

        //  Soft delete e não delete físico: Expenses aponta para cá, e o gasto de março tem
        //  que continuar apontando para a categoria em que foi lançado.
        it("arquiva a categoria e a subárvore dela", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            let grandparent = await workspaceClient.post(`/Base/Categories`, { Description: "Avó" })
            let parent = await workspaceClient.post(`/Base/Categories`, { Description: "Mãe", IdParentCategory: grandparent.body.IdCategory })
            let child = await workspaceClient.post(`/Base/Categories`, { Description: "Neta", IdParentCategory: parent.body.IdCategory })
            let sibling = await workspaceClient.post(`/Base/Categories`, { Description: "Tia sem parentesco" })

            let response = await workspaceClient.delete(`/Base/Categories/IdCategory=${grandparent.body.IdCategory}`)

            expect(response.status).toBe(200)

            //  As três linhas continuam no banco: só saíram das listas
            for (let created of [grandparent, parent, child]) {
                expect((await findCategoryById(created.body.IdCategory)).Active).toBe(false)
            }

            //  E só a subárvore: o que não descende dela não é tocado
            expect((await findCategoryById(sibling.body.IdCategory)).Active).toBe(true)
            expect((await findCategoryById(globalCategory.IdCategory)).Active).toBe(true)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passo 4 do "como saber que a leva acabou" do ROADMAP, só por HTTP: cria a categoria
        //  própria e a lê junto com as globais.
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
            expect(predefined.body.map((item: { Description: string }) => item.Description)).toEqual(["Transporte"])

            let own = await flowClient.post(`/Base/Categories`, { Description: "Faculdade", Color: "#283593" })

            expect(own.status).toBe(200)

            let sub = await flowClient.post(`/Base/Categories`, { Description: "Mensalidade", IdParentCategory: own.body.IdCategory })

            expect(sub.status).toBe(200)

            let list = await flowClient.get(`/Base/Categories`)
            let tree = byDescription(list.body)

            expect(Object.keys(tree).sort()).toEqual(["Faculdade", "Transporte"])
            expect(tree["Faculdade"]).toMatchObject({ Color: "#283593" })
            expect(tree["Faculdade"].TreeItems.map((item: { Description: string }) => item.Description)).toEqual(["Mensalidade"])

            //  A global não é dele para editar, mesmo aparecendo na mesma lista
            expect((await flowClient.put(`/Base/Categories/IdCategory=${globalCategory.IdCategory}`, { Description: "Minha" })).status).toBe(406)

            //  Arquivar a própria leva a subcategoria junto, e não encosta na global
            expect((await flowClient.delete(`/Base/Categories/IdCategory=${own.body.IdCategory}`)).status).toBe(200)

            let final = await flowClient.get(`/Base/Categories`)

            expect(final.body.map((item: { Description: string }) => item.Description)).toEqual(["Transporte"])
            expect((await findCategoryById(sub.body.IdCategory)).Active).toBe(false)
        })
    })
})

function byDescription(tree: Array<{ Description: string }>) {
    return Object.fromEntries(tree.map((item) => [item.Description, item])) as Record<string, any>
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

//  Arquiva sem passar pela rota, que arquivaria a subárvore junto: é a única forma de arranjar
//  uma filha ativa com o pai fora da lista.
function archiveDirectly(IdCategory: number) {
    return TestDatabase.connection().update({ Active: false }).from("Categories").where("IdCategory", IdCategory)
}
