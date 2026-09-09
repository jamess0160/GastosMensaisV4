import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de BudgetPeriods — o mês congelado do orçamento. Um describe por rota de
//  BudgetPeriods.route.ts, mais o fluxo end to end no fim.
//
//  A definição é arranjo, não objeto de teste: o mês vem pelo POST /Budgets porque é de lá que
//  ele nasce congelado, com o teto que valia na hora. Quem testa a definição é Budgets.test.ts.
//
//  Duas coisas carregam a suíte, e são as duas que a separação em duas tabelas comprou:
//
//  1. **mexer no mês não mexe na definição** — "em dezembro pode 1.500" não reajusta nada e não
//     vaza para agosto, que é o que faz "qual era meu teto em agosto" continuar tendo resposta;
//  2. **o delete aqui é físico**, o único do projeto: o período é plano, não lançamento. A
//     definição sobrevive a ele, porque é dela que a rotina mensal vai materializar os meses.

describe("BudgetPeriods", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Categories, Budgets e BudgetPeriods junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos orçamentos" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("PUT /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/BudgetPeriods/IdBudgetPeriod=1`, { LimitValue: 100 })

            expect(response.status).toBe(401)
        })

        //  Token legítimo, mas emitido sem workspace: o conserto é o switch, não pedir acesso
        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).put(`/BudgetPeriods/IdBudgetPeriod=1`, { LimitValue: 100 })

            expect(response.status).toBe(406)
        })

        it("recusa período inexistente", async () => {
            let response = await client.put(`/BudgetPeriods/IdBudgetPeriod=999999`, { LimitValue: 100 })

            expect(response.status).toBe(406)
        })

        //  O IdBudgetPeriod é sequencial: sem o filtro de workspace no getUnique, a matrícula
        //  conferida no próprio tenant liberaria mexer no teto do vizinho
        it("recusa o período de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner, { LimitValue: 800 })

            let response = await otherClient.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1 })

            expect(response.status).toBe(406)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  Ser membro não basta: mexer no teto é escrita, e o viewer só lê. 403, não 406 — aqui
        //  o workspace existe para ele, o que falta é o papel.
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner, { LimitValue: 800 })
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1 })

            expect(response.status).toBe(403)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  "Em dezembro pode 1.500" não mexe na definição nem em nenhum outro mês
        it("muda o teto só daquele mês", async () => {
            let workspace = await buildWorkspace()

            let august = await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            let december = await createBudget(workspace, { ReferenceMonth: "2026-12", LimitValue: 800 })

            let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${december.IdBudgetPeriod}`, {
                LimitValue: 1500,
                AlertPercent: 95,
            })

            expect(response.status).toBe(200)
            expect(await findPeriodById(december.IdBudgetPeriod)).toMatchObject({ LimitValue: 1500, AlertPercent: 95 })

            //  Agosto e a definição intactos
            expect((await findPeriodById(august.IdBudgetPeriod)).LimitValue).toBe(800)
            expect((await findBudgets(workspace.user.workspace.IdWorkspace))[0].LimitValue).toBe(800)
        })

        it("recusa mês ou orçamento no corpo", async () => {
            let workspace = await buildWorkspace()
            let created = await createBudget(workspace)

            let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                LimitValue: 900,
                ReferenceMonth: "2026-09-01",
            })

            expect(response.status).toBe(406)
        })

        //  Teto zero é não ter teto, e isso se faz apagando o mês — não zerando o número
        it("recusa teto zerado ou negativo", async () => {
            let workspace = await buildWorkspace()
            let created = await createBudget(workspace, { LimitValue: 800 })

            for (let LimitValue of [0, -100]) {
                let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue })

                expect(response.status).toBe(406)
            }

            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  O alerta é percentual do teto: fora de 1..100, ou quebrado, ele não significa nada
        it("recusa AlertPercent fora da faixa", async () => {
            let workspace = await buildWorkspace()
            let created = await createBudget(workspace)

            for (let AlertPercent of [0, 101, 80.5]) {
                let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                    LimitValue: 900,
                    AlertPercent,
                })

                expect(response.status).toBe(406)
            }
        })
    })

    describe("DELETE /BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/BudgetPeriods/IdBudgetPeriod=1`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).delete(`/BudgetPeriods/IdBudgetPeriod=1`)

            expect(response.status).toBe(406)
        })

        it("recusa período inexistente", async () => {
            let response = await client.delete(`/BudgetPeriods/IdBudgetPeriod=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa o período de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner)

            let response = await otherClient.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(406)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  Delete físico é justamente o que o viewer não pode disparar: não há Active para
        //  desfazer depois
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner)
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(403)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  Delete físico, ao contrário de toda tabela de cadastro: o período é plano, não
        //  lançamento. A definição fica, porque é dela que a rotina vai materializar os
        //  próximos meses.
        it("apaga o mês e mantém a definição", async () => {
            let workspace = await buildWorkspace()

            let created = await createBudget(workspace)

            let response = await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(200)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeUndefined()
            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(1)

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body).toEqual([])
        })

        //  Apagar um mês não leva os outros junto: o delete é por id de período, e cada mês da
        //  mesma categoria é uma linha
        it("não mexe nos outros meses da mesma categoria", async () => {
            let workspace = await buildWorkspace()

            let august = await createBudget(workspace, { ReferenceMonth: "2026-08" })
            let september = await createBudget(workspace, { ReferenceMonth: "2026-09" })

            expect((await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${august.IdBudgetPeriod}`)).status).toBe(200)

            expect(await findPeriodById(september.IdBudgetPeriod)).toBeDefined()
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body).toHaveLength(1)
        })

        //  Apagado o mês, a categoria pode ser orçada de novo nele
        it("libera o mês para um cadastro novo", async () => {
            let workspace = await buildWorkspace()

            let created = await createBudget(workspace, { LimitValue: 800 })

            await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            let response = await workspace.client.post(`/Budgets`, buildBody(workspace, { LimitValue: 500 }))

            expect(response.status).toBe(200)
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([500])
        })
    })

    describe("Fluxo end to end", () => {

        //  O ajuste de um mês, só por HTTP: orça, corrige o teto daquele mês, cadastra o mês
        //  seguinte e confirma que o ajuste ficou preso onde foi feito. Depois tira o mês, e a
        //  definição continua de pé — dá para orçar agosto de novo.
        it("ajusta um mês, não vaza para os outros e apaga sem levar a definição", async () => {
            let workspace = await buildWorkspace()

            let august = await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })

            expect((await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${august.IdBudgetPeriod}`, {
                LimitValue: 950,
                AlertPercent: 90,
            })).status).toBe(200)

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0]).toMatchObject({ LimitValue: 950, AlertPercent: 90 })

            //  Setembro cadastrado com o teto de sempre: o ajuste de agosto não virou reajuste
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body.map(limit)).toEqual([800])
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([950])

            expect((await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${august.IdBudgetPeriod}`)).status).toBe(200)

            //  Agosto sumiu da tela, setembro ficou, e a categoria pode ser orçada em agosto de
            //  novo — porque a definição nunca saiu do lugar
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body).toEqual([])
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body.map(limit)).toEqual([800])

            expect((await workspace.client.post(`/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-08", LimitValue: 700 }))).status).toBe(200)
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([700])
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    /** Orçamento é sempre de uma categoria, então todo arranjo já nasce com uma */
    IdCategory: number
}

//  Cada teste arruma o seu workspace, porque a leitura do mês devolve tudo que existe nele
async function buildWorkspace(): Promise<TestWorkspace> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    let category = await client.post(`/Categories`, { Description: "Mercado" })

    return { user, client, IdCategory: category.body.IdCategory }
}

//  Um segundo usuário matriculado como viewer no workspace de quem chamou. Não há rota de
//  convite ainda, então a matrícula vai direto ao banco — é o único estado desta suíte que o
//  app não sabe produzir sozinho, e sem ele o assertRole nunca é exercitado.
async function buildViewerClient(workspace: TestWorkspace) {
    let viewer = await UsersFactory.create({ Name: "Convidado só de leitura" })

    await TestDatabase.connection()
        .insert({ IdWorkspace: workspace.user.workspace.IdWorkspace, IdUser: viewer.user.IdUser, Role: "viewer" })
        .into("WorkspaceMembers")

    return new TestClient(UsersFactory.buildToken(viewer.user.IdUser, workspace.user.workspace.IdWorkspace))
}

function buildBody(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    return {
        IdCategory: workspace.IdCategory,
        ReferenceMonth: "2026-08",
        LimitValue: 800,
        ...overrides,
    }
}

//  O mês nasce pelo cadastro do orçamento: é o POST /Budgets que congela a linha
async function createBudget(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/Budgets`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdBudget: number, IdBudgetPeriod: number }
}

//#endregion

//#region Leitura

function limit(item: { LimitValue: number }) {
    return item.LimitValue
}

function findBudgets(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Budgets").where("IdWorkspace", IdWorkspace).orderBy("IdBudget")
}

function findPeriodById(IdBudgetPeriod: number) {
    return TestDatabase.connection().select("*").from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod).first()
}

//#endregion
