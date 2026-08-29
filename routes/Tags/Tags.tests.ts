import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Tags. Um describe por rota de Tags.route.ts — e são duas só, porque a
//  tag não tem cadastro próprio: ela nasce do texto digitado ao lançar o gasto.
//
//  Por isso o arranjo daqui passa por `POST /Base/Expenses`: é o único lugar que cria tag. O
//  que esta suíte cobre é a busca (o input de sugestão), o arquivamento, e as regras de
//  resolução do texto — mesmo nome não vira tag nova, e nome de tag arquivada a traz de volta.

describe("Tags", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts, Categories e Tags junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono das tags" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Base/Tags/search", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Base/Tags/search`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Base/Tags/search`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Base/Tags/search`)

            expect(response.status).toBe(406)
        })

        it("devolve lista vazia quando o workspace não tem tag", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Base/Tags/search`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        //  Sem termo, o input mostra as primeiras ao abrir
        it("devolve as tags do workspace em ordem de nome quando não há termo", async () => {
            let workspace = await buildWorkspace()

            await createExpenseWithTags(workspace, ["Viagem Chile", "Casamento"])

            let response = await workspace.client.get(`/Base/Tags/search`)

            expect(response.body.map(name)).toEqual(["Casamento", "Viagem Chile"])
        })

        it("filtra pelo trecho digitado, sem diferenciar maiúscula", async () => {
            let workspace = await buildWorkspace()

            await createExpenseWithTags(workspace, ["Viagem Chile", "Casamento"])

            expect((await workspace.client.get(`/Base/Tags/search?Search=via`)).body.map(name)).toEqual(["Viagem Chile"])
            expect((await workspace.client.get(`/Base/Tags/search?Search=CHILE`)).body.map(name)).toEqual(["Viagem Chile"])
            expect((await workspace.client.get(`/Base/Tags/search?Search=nada`)).body).toEqual([])
        })

        //  O % é curinga do ILIKE: sem escapar, digitá-lo listaria tudo
        it("trata o curinga do like como texto", async () => {
            let workspace = await buildWorkspace()

            await createExpenseWithTags(workspace, ["Viagem Chile"])

            expect((await workspace.client.get(`/Base/Tags/search?Search=%25`)).body).toEqual([])
        })

        it("não devolve tag arquivada nem a de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let stranger = await buildWorkspace()

            await createExpenseWithTags(stranger, ["Tag do vizinho"])
            await createExpenseWithTags(workspace, ["Tag viva", "Tag arquivada"])

            let archived = (await workspace.client.get(`/Base/Tags/search?Search=arquivada`)).body[0]

            await workspace.client.delete(`/Base/Tags/IdTag=${archived.IdTag}`)

            expect((await workspace.client.get(`/Base/Tags/search`)).body.map(name)).toEqual(["Tag viva"])
        })
    })

    describe("A tag nasce com o gasto", () => {

        it("cria a tag a partir do texto e a devolve no gasto", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpenseWithTags(workspace, ["Viagem Chile"])

            let tags = await findTags(workspace.user.workspace.IdWorkspace)

            expect(tags).toHaveLength(1)
            expect(tags[0]).toMatchObject({
                Name: "Viagem Chile",
                //  Autoria: quem usou a tag primeiro
                IdUser: workspace.user.user.IdUser,
                Active: true,
            })

            //  O gasto devolve a tag inteira, não a linha de vínculo: é o nome que a tela mostra
            let detail = await workspace.client.get(`/Base/Expenses/IdExpense=${created.IdExpense}`)

            expect(detail.body.Tags).toHaveLength(1)
            expect(detail.body.Tags[0].Name).toBe("Viagem Chile")
        })

        //  O índice unique(IdWorkspace, Name) já barraria com 500: o mesmo nome tem que
        //  reaproveitar a linha, senão cada gasto criaria uma etiqueta nova igual à anterior
        it("reaproveita a tag existente em vez de criar outra", async () => {
            let workspace = await buildWorkspace()

            let first = await createExpenseWithTags(workspace, ["Viagem Chile"])
            let second = await createExpenseWithTags(workspace, ["viagem chile"])

            expect(await findTags(workspace.user.workspace.IdWorkspace)).toHaveLength(1)

            let firstDetail = await workspace.client.get(`/Base/Expenses/IdExpense=${first.IdExpense}`)
            let secondDetail = await workspace.client.get(`/Base/Expenses/IdExpense=${second.IdExpense}`)

            expect(secondDetail.body.Tags[0].IdTag).toBe(firstDetail.body.Tags[0].IdTag)
            //  O nome gravado é o da primeira vez: renomear mudaria a etiqueta do gasto anterior
            expect(secondDetail.body.Tags[0].Name).toBe("Viagem Chile")
        })

        //  O unique(IdExpense, IdTag) do vínculo estouraria: o mesmo texto duas vezes é a mesma
        //  etiqueta digitada duas vezes, não duas tags
        it("dedupe o mesmo texto repetido no mesmo gasto", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpenseWithTags(workspace, ["Viagem", "VIAGEM", " viagem "])

            let detail = await workspace.client.get(`/Base/Expenses/IdExpense=${created.IdExpense}`)

            expect(detail.body.Tags).toHaveLength(1)
            expect(await findTags(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        //  Não existe rota de restaurar: marcar de novo com o nome é o caminho de volta, e é o
        //  que faz sentido para quem digitou — ele está usando a mesma etiqueta
        it("traz de volta a tag arquivada quando o nome é usado outra vez", async () => {
            let workspace = await buildWorkspace()

            await createExpenseWithTags(workspace, ["Viagem Chile"])

            let [tag] = await findTags(workspace.user.workspace.IdWorkspace)

            await workspace.client.delete(`/Base/Tags/IdTag=${tag.IdTag}`)

            expect((await findTagById(tag.IdTag)).Active).toBe(false)

            let created = await createExpenseWithTags(workspace, ["Viagem Chile"])

            //  A mesma linha, de volta ao ar — não uma segunda
            expect(await findTags(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
            expect((await findTagById(tag.IdTag)).Active).toBe(true)

            let detail = await workspace.client.get(`/Base/Expenses/IdExpense=${created.IdExpense}`)

            expect(detail.body.Tags[0].IdTag).toBe(tag.IdTag)
        })

        it("recusa tag em branco", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Base/Expenses`, buildExpense(workspace, { Tags: ["   "] }))

            expect(response.status).toBe(406)
        })

        //  A tag é do workspace: o mesmo nome em dois tenants são duas linhas
        it("cria a tag no workspace de quem lançou", async () => {
            let first = await buildWorkspace()
            let second = await buildWorkspace()

            await createExpenseWithTags(first, ["Viagem"])
            await createExpenseWithTags(second, ["Viagem"])

            expect(await findTags(first.user.workspace.IdWorkspace)).toHaveLength(1)
            expect(await findTags(second.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        //  Se o gasto cair, a tag criada no meio do caminho não pode sobrar
        it("não deixa a tag sobrar quando o gasto falha", async () => {
            let workspace = await buildWorkspace()

            //  Rateio que não fecha: a recusa acontece antes da transaction, mas o teste garante
            //  que nenhuma tag ficou para trás por qualquer caminho de erro
            let response = await workspace.client.post(`/Base/Expenses`, buildExpense(workspace, {
                Tags: ["Tag fantasma"],
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 50 }],
            }))

            expect(response.status).toBe(406)
            expect(await findTags(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })
    })

    describe("DELETE /Base/Tags/IdTag=:IdTag", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Base/Tags/IdTag=1`)

            expect(response.status).toBe(401)
        })

        it("recusa tag inexistente", async () => {
            let response = await client.delete(`/Base/Tags/IdTag=999999`)

            expect(response.status).toBe(406)
        })

        //  O IdTag é sequencial: sem o filtro de workspace no getUnique, a matrícula conferida
        //  no próprio tenant liberaria arquivar a tag do vizinho
        it("recusa a tag de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createExpenseWithTags(owner, ["Tag do dono"])

            let [tag] = await findTags(owner.user.workspace.IdWorkspace)

            let response = await otherClient.delete(`/Base/Tags/IdTag=${tag.IdTag}`)

            expect(response.status).toBe(406)
            expect((await findTagById(tag.IdTag)).Active).toBe(true)
        })

        //  Soft delete, e aqui ele pesa mais: ExpenseTags aponta para Tags com ON DELETE
        //  CASCADE, então o delete físico apagaria em silêncio a marcação de todos os gastos
        it("arquiva sem apagar a linha nem o vínculo com os gastos", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpenseWithTags(workspace, ["Viagem antiga"])

            let [tag] = await findTags(workspace.user.workspace.IdWorkspace)

            let response = await workspace.client.delete(`/Base/Tags/IdTag=${tag.IdTag}`)

            expect(response.status).toBe(200)
            expect((await findTagById(tag.IdTag)).Active).toBe(false)

            //  O vínculo continua: o gasto do ano passado não perde a etiqueta
            expect(await findExpenseTags(created.IdExpense)).toHaveLength(1)
        })

        it("recusa arquivar duas vezes", async () => {
            let workspace = await buildWorkspace()

            await createExpenseWithTags(workspace, ["Viagem"])

            let [tag] = await findTags(workspace.user.workspace.IdWorkspace)

            await workspace.client.delete(`/Base/Tags/IdTag=${tag.IdTag}`)

            let response = await workspace.client.delete(`/Base/Tags/IdTag=${tag.IdTag}`)

            expect(response.status).toBe(406)
        })
    })

    describe("Fluxo end to end", () => {

        it("digita a tag no gasto, busca no input e arquiva", async () => {
            let payload = {
                Name: "Usuário do fluxo de tags",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Base/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            let account = await flowClient.post(`/Base/Accounts`, { Name: "Conta corrente", InitialBalance: 1000 })
            let methods = (await flowClient.get(`/Base/Accounts`)).body[0].PaymentMethods
            let debit = methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod
            let category = await flowClient.post(`/Base/Categories`, { Description: "Lazer" })

            //  Nada cadastrado: o input abre vazio
            expect((await flowClient.get(`/Base/Tags/search`)).body).toEqual([])

            //  A tag nasce com o gasto, a partir do texto digitado
            let first = await flowClient.post(`/Base/Expenses`, {
                Description: "Passagem",
                TotalValue: 800,
                IdCategory: category.body.IdCategory,
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: debit, Value: 800 }],
                Tags: ["Viagem Chile"],
            })

            expect(first.status).toBe(200)
            expect(account.status).toBe(200)

            //  Agora o input sugere ela ao digitar
            let suggestion = await flowClient.get(`/Base/Tags/search?Search=via`)

            expect(suggestion.body).toHaveLength(1)
            expect(suggestion.body[0].Name).toBe("Viagem Chile")

            //  O segundo gasto usa a mesma etiqueta, sem criar outra
            let second = await flowClient.post(`/Base/Expenses`, {
                Description: "Hotel",
                TotalValue: 1200,
                IdCategory: category.body.IdCategory,
                ExpenseDate: "2026-08-11",
                Payments: [{ IdPaymentMethod: debit, Value: 1200 }],
                Tags: ["Viagem Chile", "Presente"],
            })

            expect(second.status).toBe(200)
            expect((await flowClient.get(`/Base/Tags/search`)).body.map(name)).toEqual(["Presente", "Viagem Chile"])

            //  A viagem acabou: arquivar tira da sugestão sem tocar nos dois gastos marcados
            let trip = suggestion.body[0]

            expect((await flowClient.delete(`/Base/Tags/IdTag=${trip.IdTag}`)).status).toBe(200)
            expect((await flowClient.get(`/Base/Tags/search`)).body.map(name)).toEqual(["Presente"])

            let detail = await flowClient.get(`/Base/Expenses/IdExpense=${second.body.IdExpense}`)

            //  O gasto continua marcado — só a sugestão perdeu a tag
            expect(detail.body.Tags.map(name).sort()).toEqual(["Presente", "Viagem Chile"])
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    IdDebit: number
    IdCategory: number
}

//  Tag só nasce dentro de um gasto, e gasto precisa de conta, forma de pagamento e categoria:
//  este é o mínimo para conseguir digitar uma etiqueta.
async function buildWorkspace(): Promise<TestWorkspace> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    await client.post(`/Base/Accounts`, { Name: "Conta corrente", InitialBalance: 1000 })

    let methods = (await client.get(`/Base/Accounts`)).body[0].PaymentMethods
    let category = await client.post(`/Base/Categories`, { Description: "Categoria" })

    return {
        user,
        client,
        IdDebit: methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod,
        IdCategory: category.body.IdCategory,
    }
}

function buildExpense(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    return {
        Description: "Gasto de teste",
        TotalValue: 100,
        IdCategory: workspace.IdCategory,
        ExpenseDate: "2026-08-10",
        Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 100 }],
        ...overrides,
    }
}

async function createExpenseWithTags(workspace: TestWorkspace, Tags: string[]) {
    let response = await workspace.client.post(`/Base/Expenses`, buildExpense(workspace, { Tags }))

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number }
}

//#endregion

//#region Leitura

function name(item: { Name: string }) {
    return item.Name
}

function findTags(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Tags").where("IdWorkspace", IdWorkspace).orderBy("IdTag")
}

function findTagById(IdTag: number) {
    return TestDatabase.connection().select("*").from("Tags").where("IdTag", IdTag).first()
}

function findExpenseTags(IdExpense: number) {
    return TestDatabase.connection().select("*").from("ExpenseTags").where("IdExpense", IdExpense)
}

//#endregion
