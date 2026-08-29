import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Budgets e BudgetPeriods — a entrega reduzida do orçamento, em que o
//  cadastro do mês é manual. Um describe por rota das duas features, mais o fluxo end to end.
//
//  Duas coisas carregam a suíte:
//
//  1. **duas tabelas, dois efeitos** — a definição é única por categoria e acompanha o teto
//     novo; o mês é congelado e não se mexe sozinho. É o que faz "em agosto meu teto era 800"
//     continuar tendo resposta depois do reajuste de setembro;
//  2. **o comprometido** — a parcela conta no mês em que vence, não no mês da compra, e o
//     pendente conta junto com o pago, ao contrário do saldo.

describe("Budgets", () => {

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

    describe("GET /Base/Budgets", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        //  O mês é a unidade aqui, ao contrário das listagens de movimento
        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08-01`)).status).toBe(406)
            expect((await workspace.client.get(`/Base/Budgets`)).status).toBe(406)
        })

        it("devolve lista vazia quando o mês não tem orçamento", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        it("devolve o teto do mês com a categoria e o comprometido zerado", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            let response = await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0]).toMatchObject({
                LimitValue: 800,
                AlertPercent: 80,
                //  Nasce aberto: fechar o mês é trabalho da rotina, que ainda não existe
                Status: "open",
                ClosedAt: null,
                //  Sempre o dia 1 do mês
                ReferenceMonth: "2026-08-01",
                Spent: 0,
            })
            expect(response.body[0].Category.Description).toBe("Mercado")
        })

        //  Cada mês é uma linha: o de agosto não aparece na consulta de setembro
        it("devolve só o mês pedido", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 900 })

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([800])
            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-09`)).body.map(limit)).toEqual([900])
        })

        it("não devolve o orçamento de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createBudget(owner)

            expect((await otherClient.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body).toEqual([])
        })

        //  **O número que dá sentido ao teto.** Gasto lançado no mês, na categoria orçada.
        it("soma o gasto do mês na categoria orçada", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-08-10" })
            await createExpense(workspace, { TotalValue: 120.5, ExpenseDate: "2026-08-28" })
            //  Fora do mês e fora da categoria não entram
            await createExpense(workspace, { TotalValue: 999, ExpenseDate: "2026-09-02" })
            await createExpense(workspace, { TotalValue: 999, ExpenseDate: "2026-08-15", IdCategory: await createCategory(workspace, "Lazer") })

            let response = await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(response.body[0].Spent).toBe(420.5)
        })

        //  Orçamento é **comprometido**, não realizado: o gasto lançado e ainda não quitado já
        //  consumiu o teto. É o oposto do saldo da conta, que só soma perna paga.
        it("conta o gasto pendente junto com o pago", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 100, ExpenseDate: "2026-08-10", Paid: true })
            await createExpense(workspace, { TotalValue: 200, ExpenseDate: "2026-08-11" })

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(300)
        })

        it("não conta gasto cancelado", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            let canceled = await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-08-10" })

            await workspace.client.delete(`/Base/Expenses/IdExpense=${canceled.IdExpense}`)

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(0)
        })

        //  **A parcela pesa no mês em que vence, não no mês da compra.** Somar os 600 em agosto
        //  estouraria o teto por uma dívida que é de meio ano.
        it("distribui a compra parcelada pelos meses das parcelas", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
            })

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(100)
            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-09`)).body[0].Spent).toBe(100)
        })

        //  No cartão, o que pesa no mês é a fatura que vence nele — a compra do dia 21 num
        //  cartão que fecha no 20 já é do mês seguinte
        it("usa o vencimento da fatura no gasto de cartão", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 150, ExpenseDate: "2026-08-21", IdPaymentMethod: card })

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(0)
            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-09`)).body[0].Spent).toBe(150)
        })
    })

    describe("POST /Base/Budgets", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Base/Budgets`, {
                IdCategory: 1,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem categoria, mês ou valor", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/Base/Budgets`, {})).status).toBe(406)
            expect((await workspace.client.post(`/Base/Budgets`, { IdCategory: workspace.IdCategory, ReferenceMonth: "2026-08" })).status).toBe(406)
        })

        //  Teto zero é não ter teto, e isso se faz apagando o mês
        it("recusa teto zero ou negativo", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { LimitValue: 0 }))).status).toBe(406)
        })

        //  O IdCategory é sequencial e chega do cliente
        it("recusa categoria de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let stranger = await buildWorkspace()

            let response = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { IdCategory: stranger.IdCategory }))

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await buildWorkspace()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.user.workspace.IdWorkspace))

            let response = await forged.post(`/Base/Budgets`, buildBody(owner))

            expect(response.status).toBe(406)
            expect(await findBudgets(owner.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  As duas escritas na mesma transaction: a definição vigente e o mês congelado
        it("cria a definição e o mês de uma vez", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { LimitValue: 800, AlertPercent: 90 }))

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ IdBudget: expect.any(Number), IdBudgetPeriod: expect.any(Number) })

            let [budget] = await findBudgets(workspace.user.workspace.IdWorkspace)

            expect(budget).toMatchObject({
                IdCategory: workspace.IdCategory,
                LimitValue: 800,
                AlertPercent: 90,
                IdUser: workspace.user.user.IdUser,
                Active: true,
            })

            let [period] = await findPeriods(budget.IdBudget)

            expect(period).toMatchObject({
                ReferenceMonth: "2026-08-01",
                LimitValue: 800,
                AlertPercent: 90,
                Status: "open",
            })
        })

        //  unique(IdWorkspace, IdCategory): o cadastro do segundo mês reencontra a definição em
        //  vez de tentar criar outra e estourar 23505
        it("reaproveita a definição no cadastro do mês seguinte", async () => {
            let workspace = await buildWorkspace()

            let first = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 }))
            let second = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-09", LimitValue: 900 }))

            expect(second.status).toBe(200)
            expect(second.body.IdBudget).toBe(first.body.IdBudget)

            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
            expect(await findPeriods(first.body.IdBudget)).toHaveLength(2)
        })

        //  **A definição é a vigente; o mês fechado guarda o que valeu.** É todo o motivo de
        //  existirem duas tabelas.
        it("atualiza a definição sem reescrever o mês já cadastrado", async () => {
            let workspace = await buildWorkspace()

            let first = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 }))

            await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-09", LimitValue: 1000 }))

            let [budget] = await findBudgets(workspace.user.workspace.IdWorkspace)

            //  A definição passou a valer o teto novo
            expect(budget.LimitValue).toBe(1000)

            //  E agosto continua sendo 800
            expect((await findPeriods(first.body.IdBudget)).map((period) => period.LimitValue)).toEqual([800, 1000])
        })

        //  unique(IdBudget, ReferenceMonth) já barraria, mas com 500 — e a resposta importa: o
        //  conserto é editar o mês que existe
        it("recusa orçar a mesma categoria duas vezes no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace)

            let response = await workspace.client.post(`/Base/Budgets`, buildBody(workspace))

            expect(response.status).toBe(406)
        })

        //  Duas categorias, dois tetos no mesmo mês
        it("aceita mais de uma categoria no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace)
            await createBudget(workspace, { IdCategory: await createCategory(workspace, "Lazer") })

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body).toHaveLength(2)
        })
    })

    describe("PUT /Base/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Base/BudgetPeriods/IdBudgetPeriod=1`, { LimitValue: 100 })

            expect(response.status).toBe(401)
        })

        it("recusa período inexistente", async () => {
            let response = await client.put(`/Base/BudgetPeriods/IdBudgetPeriod=999999`, { LimitValue: 100 })

            expect(response.status).toBe(406)
        })

        //  O IdBudgetPeriod é sequencial: sem o filtro de workspace no getUnique, a matrícula
        //  conferida no próprio tenant liberaria mexer no teto do vizinho
        it("recusa o período de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner, { LimitValue: 800 })

            let response = await otherClient.put(`/Base/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1 })

            expect(response.status).toBe(406)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  "Em dezembro pode 1.500" não mexe na definição nem em nenhum outro mês
        it("muda o teto só daquele mês", async () => {
            let workspace = await buildWorkspace()

            let august = await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            let december = await createBudget(workspace, { ReferenceMonth: "2026-12", LimitValue: 800 })

            let response = await workspace.client.put(`/Base/BudgetPeriods/IdBudgetPeriod=${december.IdBudgetPeriod}`, {
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

            let response = await workspace.client.put(`/Base/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                LimitValue: 900,
                ReferenceMonth: "2026-09-01",
            })

            expect(response.status).toBe(406)
        })
    })

    describe("DELETE /Base/BudgetPeriods/IdBudgetPeriod=:IdBudgetPeriod", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Base/BudgetPeriods/IdBudgetPeriod=1`)

            expect(response.status).toBe(401)
        })

        it("recusa período inexistente", async () => {
            let response = await client.delete(`/Base/BudgetPeriods/IdBudgetPeriod=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa o período de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createBudget(owner)

            let response = await otherClient.delete(`/Base/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(406)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  Delete físico, ao contrário de toda tabela de cadastro: o período é plano, não
        //  lançamento. A definição fica, porque é dela que a rotina vai materializar os
        //  próximos meses.
        it("apaga o mês e mantém a definição", async () => {
            let workspace = await buildWorkspace()

            let created = await createBudget(workspace)

            let response = await workspace.client.delete(`/Base/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(200)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeUndefined()
            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(1)

            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body).toEqual([])
        })

        //  Apagado o mês, a categoria pode ser orçada de novo nele
        it("libera o mês para um cadastro novo", async () => {
            let workspace = await buildWorkspace()

            let created = await createBudget(workspace, { LimitValue: 800 })

            await workspace.client.delete(`/Base/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            let response = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, { LimitValue: 500 }))

            expect(response.status).toBe(200)
            expect((await workspace.client.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([500])
        })
    })

    describe("Fluxo end to end", () => {

        //  O mês de uso do orçamento, só por HTTP: orça, gasta, acompanha o comprometido,
        //  ajusta o mês e cadastra o mês seguinte com o teto novo
        it("orça a categoria, acompanha o comprometido e vira o mês", async () => {
            let payload = {
                Name: "Usuário do fluxo de orçamento",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Base/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            await flowClient.post(`/Base/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })

            let methods = (await flowClient.get(`/Base/Accounts`)).body[0].PaymentMethods
            let debit = methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod
            let category = await flowClient.post(`/Base/Categories`, { Description: "Mercado" })

            //  Agosto: teto de 800
            let august = await flowClient.post(`/Base/Budgets`, {
                IdCategory: category.body.IdCategory,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(august.status).toBe(200)

            let empty = await flowClient.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(empty.body[0]).toMatchObject({ LimitValue: 800, Spent: 0, AlertPercent: 80 })

            //  Duas compras no mês, uma quitada e outra não: as duas comprometem o teto
            for (let expense of [{ Value: 300, Paid: true }, { Value: 250, Paid: false }]) {
                expect((await flowClient.post(`/Base/Expenses`, {
                    Description: "Compra do mês",
                    TotalValue: expense.Value,
                    IdCategory: category.body.IdCategory,
                    ExpenseDate: "2026-08-12",
                    Payments: [{ IdPaymentMethod: debit, Value: expense.Value, Paid: expense.Paid }],
                })).status).toBe(200)
            }

            let used = await flowClient.get(`/Base/Budgets?ReferenceMonth=2026-08`)

            expect(used.body[0].Spent).toBe(550)
            //  O alerta é do cliente: a API entrega os três números que ele compara
            expect(used.body[0].Spent / used.body[0].LimitValue).toBeGreaterThan(0.68)

            //  O mês apertou: sobe o teto só de agosto
            expect((await flowClient.put(`/Base/BudgetPeriods/IdBudgetPeriod=${august.body.IdBudgetPeriod}`, { LimitValue: 900 })).status).toBe(200)
            expect((await flowClient.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0].LimitValue).toBe(900)

            //  Setembro é cadastrado à mão — é isto que a rotina vai automatizar
            expect((await flowClient.post(`/Base/Budgets`, {
                IdCategory: category.body.IdCategory,
                ReferenceMonth: "2026-09",
                LimitValue: 850,
            })).status).toBe(200)

            let september = await flowClient.get(`/Base/Budgets?ReferenceMonth=2026-09`)

            //  Mês novo, gasto zerado — e agosto continua com os 900 e os 550
            expect(september.body[0]).toMatchObject({ LimitValue: 850, Spent: 0 })
            expect((await flowClient.get(`/Base/Budgets?ReferenceMonth=2026-08`)).body[0]).toMatchObject({ LimitValue: 900, Spent: 550 })
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    IdCategory: number
    IdDebit: number
}

//  Orçamento precisa de categoria; o comprometido precisa de gasto, que precisa de conta e
//  forma de pagamento. Cada teste arruma o seu, porque o comprometido é soma de tudo que existe.
async function buildWorkspace(): Promise<TestWorkspace> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    await client.post(`/Base/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })

    let methods = (await client.get(`/Base/Accounts`)).body[0].PaymentMethods
    let category = await client.post(`/Base/Categories`, { Description: "Mercado" })

    return {
        user,
        client,
        IdCategory: category.body.IdCategory,
        IdDebit: methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod,
    }
}

function createCategory(workspace: TestWorkspace, Description: string) {
    return workspace.client.post(`/Base/Categories`, { Description }).then((response) => response.body.IdCategory as number)
}

async function createCard(workspace: TestWorkspace) {
    let account = (await workspace.client.get(`/Base/Accounts`)).body[0]

    let response = await workspace.client.post(`/Base/PaymentMethods`, {
        IdAccount: account.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        ClosingDay: 20,
        DueDay: 28,
    })

    return response.body.IdPaymentMethod as number
}

function buildBody(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    return {
        IdCategory: workspace.IdCategory,
        ReferenceMonth: "2026-08",
        LimitValue: 800,
        ...overrides,
    }
}

async function createBudget(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/Base/Budgets`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdBudget: number, IdBudgetPeriod: number }
}

async function createExpense(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let { Paid, IdPaymentMethod, ...rest } = overrides

    let response = await workspace.client.post(`/Base/Expenses`, {
        Description: "Compra do mês",
        TotalValue: 100,
        IdCategory: workspace.IdCategory,
        ExpenseDate: "2026-08-10",
        Payments: [{
            IdPaymentMethod: IdPaymentMethod ?? workspace.IdDebit,
            Value: overrides.TotalValue ?? 100,
            Paid: Boolean(Paid),
        }],
        ...rest,
    })

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number }
}

//#endregion

//#region Leitura

function limit(item: { LimitValue: number }) {
    return item.LimitValue
}

function findBudgets(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Budgets").where("IdWorkspace", IdWorkspace).orderBy("IdBudget")
}

function findPeriods(IdBudget: number) {
    return TestDatabase.connection().select("*").from("BudgetPeriods").where("IdBudget", IdBudget).orderBy("ReferenceMonth")
}

function findPeriodById(IdBudgetPeriod: number) {
    return TestDatabase.connection().select("*").from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod).first()
}

//#endregion
