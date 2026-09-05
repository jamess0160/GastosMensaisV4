import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de ExpensePayments — a perna do gasto, o eixo financeiro. Um describe por
//  rota de ExpensePayments.route.ts, mais o fluxo end to end no fim.
//
//  O gasto é arranjo, não objeto de teste: a perna nasce pelo POST /Expenses porque é de lá que
//  ela sai com o valor e as datas de fatura certos. Quem testa o gasto é Expenses.test.ts.
//
//  Três coisas carregam a suíte:
//
//  1. **é o quitar que move saldo** — a leitura de saldo só soma perna paga, então este clique
//     é o que tira (e o desquitar, o que devolve) o dinheiro da conta;
//  2. **quitar é por perna, e isso nunca vira status parcial** — 1 de 6 parcelas paga deixa a
//     compra pendente. O Status é derivado e recalculado na mesma transaction;
//  3. **desquitar existe porque quitar errado precisa de conserto** — sem ele um clique a mais
//     tiraria dinheiro da conta sem volta.

describe("ExpensePayments", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts, Categories e Expenses junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos gastos" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /ExpensePayments", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/ExpensePayments`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/ExpensePayments`)

            expect(response.status).toBe(406)
        })

        //  **O teste que justifica a rota.** A compra é de março e não aparece na lista de
        //  gastos de agosto, que filtra por ExpenseDate — mas a 6ª parcela dela vence em agosto
        //  e pesa lá. Era isso que o cliente compensava varrendo 24 meses para trás.
        it("traz a 6ª parcela de uma compra de março na consulta de agosto", async () => {
            let workspace = await buildWorkspace()
            let created = await createInstallment(workspace, { ExpenseDate: "2026-03-10" })

            let response = await workspace.client.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)

            let leg = response.body[0]

            expect(leg.IdExpense).toBe(created.IdExpense)
            expect(leg.InstallmentNumber).toBe(6)
            expect(leg.Value).toBe(100)
            //  Compra em 10/03 num cartão que vence dia 28 com folga de 8 (fecha no dia 20):
            //  a 1ª parcela vence em 28/03 e a 6ª em 28/08.
            expect(leg.DueDate).toBe("2026-08-28")
            //  O gasto de origem vem junto: é o que a tela mostra na linha
            expect(leg.Expense.IdExpense).toBe(created.IdExpense)
            expect(leg.Expense.TotalValue).toBe(600)
            expect(leg.Expense.ExpenseDate).toBe("2026-03-10")

            //  E a outra metade do furo: a lista de gastos de agosto não sabe desta compra
            let expenses = await workspace.client.get(`/Expenses?From=2026-08-01&To=2026-08-31`)

            expect(expenses.body.find((item: { IdExpense: number }) => item.IdExpense === created.IdExpense)).toBeUndefined()
        })

        //  Fora do cartão não há fatura, então DueDate é nula e quem responde pelo mês é a
        //  ExpenseDate — é o coalesce inteiro exercitado pelo outro lado.
        it("traz o gasto de débito pela data da compra, com DueDate nula", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { ExpenseDate: "2026-08-10" })

            let response = await workspace.client.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0].IdExpense).toBe(created.IdExpense)
            expect(response.body[0].DueDate).toBeNull()
            expect(response.body[0].ClosingDate).toBeNull()

            //  E fora do intervalo ela não aparece: o recorte é da perna, não do workspace
            expect((await workspace.client.get(`/ExpensePayments?From=2026-09-01&To=2026-09-30`)).body).toHaveLength(0)
        })

        //  A mesma regra que GET /Expenses tem: as duas listas do mesmo mês não podem discordar
        //  sobre o que contêm.
        it("esconde a perna de gasto cancelado, e a traz com IncludeCanceled=true", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { ExpenseDate: "2026-08-10" })

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect((await workspace.client.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31`)).body).toHaveLength(0)

            let withCanceled = await workspace.client.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31&IncludeCanceled=true`)

            expect(withCanceled.body).toHaveLength(1)
            //  O gasto vem junto mesmo cancelado: sem isso a perna viria sem a linha de origem
            expect(withCanceled.body[0].Expense.Status).toBe("canceled")
        })

        //  **O rateio que acompanha a perna é o do GASTO.** As seis parcelas trazem o mesmo
        //  rateio de 600 — somar pessoa a pessoa, perna a perna, dá 3600. Nada estoura: o
        //  número só fica errado, e é por isso que este teste existe.
        it("repete o rateio do gasto em cada parcela, com o valor do total", async () => {
            let workspace = await buildWorkspace()
            let person = await workspace.client.post(`/Persons`, { Name: "Maria" })

            await createInstallment(workspace, {
                ExpenseDate: "2026-03-10",
                Persons: [{ IdPerson: person.body.IdPerson, Value: 600 }],
            })

            let response = await workspace.client.get(`/ExpensePayments?From=2026-03-01&To=2026-08-31`)

            expect(response.body).toHaveLength(6)

            for (let leg of response.body) {
                expect(leg.Value).toBe(100)
                expect(leg.Persons).toHaveLength(1)
                //  600, não 100: o rateio é do gasto e a proporção é conta de quem consome
                expect(leg.Persons[0].Value).toBe(600)
                expect(leg.Persons[0].IdPerson).toBe(person.body.IdPerson)
            }
        })

        //  O gasto sem rateio devolve a lista vazia, e não a chave ausente: a tela que itera
        //  não pode ter que checar undefined antes.
        it("devolve rateio vazio quando o gasto não tem", async () => {
            let workspace = await buildWorkspace()

            await createExpense(workspace, { ExpenseDate: "2026-08-10" })

            let response = await workspace.client.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31`)

            expect(response.body[0].Persons).toEqual([])
        })

        //  O recorte é por workspace, como toda leitura: sem ele a lista do mês traria as
        //  parcelas do vizinho junto com as próprias.
        it("nunca traz a perna de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { ExpenseDate: "2026-08-10" })

            let response = await otherClient.get(`/ExpensePayments?From=2026-08-01&To=2026-08-31`)

            expect(response.status).toBe(200)
            expect(response.body.find((item: { IdExpense: number }) => item.IdExpense === created.IdExpense)).toBeUndefined()
        })

        //  As duas pontas são opcionais, como em toda listagem de movimento
        it("aceita o período sem pontas e devolve tudo, na ordem do desembolso", async () => {
            let workspace = await buildWorkspace()

            await createInstallment(workspace, { ExpenseDate: "2026-03-10" })
            await createExpense(workspace, { ExpenseDate: "2026-01-05" })

            let response = await workspace.client.get(`/ExpensePayments`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(7)

            //  Ordenado pela data em que a perna pesa, não pela data da compra: o gasto de
            //  janeiro vem antes das parcelas da compra de março.
            let dates = response.body.map((leg: { DueDate: string | null, Expense: { ExpenseDate: string } }) => leg.DueDate ?? leg.Expense.ExpenseDate)

            expect(dates).toEqual(["2026-01-05", "2026-03-28", "2026-04-28", "2026-05-28", "2026-06-28", "2026-07-28", "2026-08-28"])
        })
    })

    describe("POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/pay", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/ExpensePayments/IdExpensePayment=1/pay`)

            expect(response.status).toBe(401)
        })

        //  Token legítimo, mas emitido sem workspace: o conserto é o switch, não pedir acesso
        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/ExpensePayments/IdExpensePayment=1/pay`)

            expect(response.status).toBe(406)
        })

        it("recusa perna inexistente", async () => {
            let response = await client.post(`/ExpensePayments/IdExpensePayment=999999/pay`)

            expect(response.status).toBe(406)
        })

        //  O IdExpensePayment é sequencial: sem o filtro de workspace, quitar a perna do vizinho
        //  mexeria no saldo dele
        it("recusa a perna de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner)
            let [payment] = await findPayments(created.IdExpense)

            let response = await otherClient.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)

            expect(response.status).toBe(406)
            expect((await findPayments(created.IdExpense))[0].Paid).toBe(false)
        })

        //  Ser membro não basta: quitar move dinheiro, e o viewer só lê. 403, não 406 — aqui o
        //  workspace existe para ele, o que falta é o papel.
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner)
            let [payment] = await findPayments(created.IdExpense)
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)

            expect(response.status).toBe(403)
            expect((await findPayments(created.IdExpense))[0].Paid).toBe(false)
        })

        //  **É o quitar que move o saldo**: a leitura só soma perna paga
        it("quita a perna, grava o instante e tira o dinheiro da conta", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 250 })
            let [payment] = await findPayments(created.IdExpense)

            expect(await accountBalance(workspace)).toBe(1000)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)

            expect(response.status).toBe(200)

            let paid = (await findPayments(created.IdExpense))[0]

            expect(paid.Paid).toBe(true)
            expect(paid.PaidAt).not.toBeNull()
            expect((await findExpense(created.IdExpense)).Status).toBe("paid")
            expect(await accountBalance(workspace)).toBe(750)
        })

        //  Quitar é por perna, e o detalhe **nunca** sobe para o gasto como status parcial:
        //  1 de 6 parcelas paga é uma compra ainda pendente. O saldo, esse sim, anda por parcela.
        it("quita uma parcela sem promover a compra a paga", async () => {
            let workspace = await buildWorkspace()
            let created = await createInstallment(workspace)
            let payments = await findPayments(created.IdExpense)

            expect(payments).toHaveLength(6)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payments[0].IdExpensePayment}/pay`)

            expect(response.status).toBe(200)
            expect((await findExpense(created.IdExpense)).Status).toBe("pending")
            expect(await accountBalance(workspace)).toBe(900)
        })

        it("recusa quitar duas vezes", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { Paid: true })
            let [payment] = await findPayments(created.IdExpense)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)

            expect(response.status).toBe(406)
        })

        //  A perna não sabe do Status do gasto: quem sabe é o gasto. Quitar parcela de compra
        //  cancelada faria o saldo sair de uma compra que não existe mais.
        it("recusa quitar parcela de gasto cancelado", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)
            let [payment] = await findPayments(created.IdExpense)

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)

            expect(response.status).toBe(406)
        })
    })

    describe("POST /ExpensePayments/IdExpensePayment=:IdExpensePayment/unpay", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/ExpensePayments/IdExpensePayment=1/unpay`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/ExpensePayments/IdExpensePayment=1/unpay`)

            expect(response.status).toBe(406)
        })

        it("recusa perna inexistente", async () => {
            let response = await client.post(`/ExpensePayments/IdExpensePayment=999999/unpay`)

            expect(response.status).toBe(406)
        })

        //  Desfazer a quitação do vizinho devolveria dinheiro à conta dele
        it("recusa a perna de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner, { Paid: true })
            let [payment] = await findPayments(created.IdExpense)

            let response = await otherClient.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/unpay`)

            expect(response.status).toBe(406)
            expect((await findPayments(created.IdExpense))[0].Paid).toBe(true)
        })

        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner, { Paid: true })
            let [payment] = await findPayments(created.IdExpense)
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/unpay`)

            expect(response.status).toBe(403)
            expect((await findPayments(created.IdExpense))[0].Paid).toBe(true)
        })

        //  Simétrico ao "recusa quitar duas vezes": desquitar o que já está em aberto colocaria
        //  dinheiro de volta numa conta de onde ele nunca saiu
        it("recusa desquitar perna que não está quitada", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 250 })
            let [payment] = await findPayments(created.IdExpense)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/unpay`)

            expect(response.status).toBe(406)
            expect(await accountBalance(workspace)).toBe(1000)
        })

        //  Cancelar um gasto quitado já é o estorno — a leitura de saldo pula gasto cancelado.
        //  Desquitar a perna depois disso não teria dinheiro nenhum para devolver.
        it("recusa desquitar parcela de gasto cancelado", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 250, Paid: true })
            let [payment] = await findPayments(created.IdExpense)

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/unpay`)

            expect(response.status).toBe(406)
        })

        //  Desquitar existe porque quitar errado precisa de conserto
        it("desquita, apaga o instante e devolve o dinheiro para a conta", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 250, Paid: true })
            let [payment] = await findPayments(created.IdExpense)

            expect(await accountBalance(workspace)).toBe(750)

            let response = await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/unpay`)

            expect(response.status).toBe(200)

            let reopened = (await findPayments(created.IdExpense))[0]

            expect(reopened.Paid).toBe(false)
            //  O instante vai junto: uma perna em aberto com PaidAt preenchido seria um recibo
            //  de pagamento que não aconteceu
            expect(reopened.PaidAt).toBeNull()
            expect(await accountBalance(workspace)).toBe(1000)
            //  O Status volta junto: ele é derivado, não guardado
            expect((await findExpense(created.IdExpense)).Status).toBe("pending")
        })
    })

    describe("Fluxo end to end", () => {

        //  A vida de uma compra parcelada pelo lado do dinheiro, só por HTTP: as parcelas caem
        //  uma a uma, o gasto só vira pago na última, e um clique errado tem volta.
        it("quita as parcelas uma a uma, fecha a compra e desfaz o clique errado", async () => {
            let workspace = await buildWorkspace()

            let created = await createInstallment(workspace)

            let detail = await workspace.client.get(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(detail.status).toBe(200)
            expect(detail.body.Payments).toHaveLength(6)
            //  A perna nasce em aberto: no cartão nada está pago no ato da compra
            expect(detail.body.Payments.every((item: { Paid: boolean }) => item.Paid === false)).toBe(true)
            expect(await accountBalance(workspace, "2026-08")).toBe(1000)

            let payments = detail.body.Payments as Array<{ IdExpensePayment: number, DueDate: string }>
            let ids = payments.map((item) => item.IdExpensePayment)

            //  Compra de 10/08 num cartão que fecha no dia 20: a primeira parcela vence em
            //  28/08 e as outras cinco rolam um mês cada.
            let months = payments.map((item) => item.DueDate.slice(0, 7))

            expect(months).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"])

            //  Cinco parcelas pagas e a compra ainda é pendente: 'paid' só quando todas caírem
            for (let index = 0; index < 5; index++) {
                expect((await workspace.client.post(`/ExpensePayments/IdExpensePayment=${ids[index]}/pay`)).status).toBe(200)

                expect((await workspace.client.get(`/Expenses/IdExpense=${created.IdExpense}`)).body.Status).toBe("pending")

                //  O saldo é sempre o saldo **de um mês**: quitar hoje a parcela de novembro
                //  não tira 100 do saldo de agosto — a parcela sai na data da fatura dela.
                expect(await accountBalance(workspace, "2026-08")).toBe(900)

                //  No mês da própria parcela o acumulado aparece: cada uma tirou os seus 100
                expect(await accountBalance(workspace, months[index])).toBe(1000 - (index + 1) * 100)
            }

            expect((await workspace.client.post(`/ExpensePayments/IdExpensePayment=${ids[5]}/pay`)).status).toBe(200)

            expect((await workspace.client.get(`/Expenses/IdExpense=${created.IdExpense}`)).body.Status).toBe("paid")
            expect(await accountBalance(workspace, "2027-01")).toBe(400)
            expect(await accountBalance(workspace, "2026-08")).toBe(900)

            //  Marcou a última sem querer: desquita e tudo volta — saldo e status
            expect((await workspace.client.post(`/ExpensePayments/IdExpensePayment=${ids[5]}/unpay`)).status).toBe(200)

            let reopened = await workspace.client.get(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(reopened.body.Status).toBe("pending")
            expect(reopened.body.Payments.filter((item: { Paid: boolean }) => item.Paid)).toHaveLength(5)
            expect(await accountBalance(workspace, "2027-01")).toBe(500)

            //  E desquitar de novo é recusado: a perna já está em aberto
            expect((await workspace.client.post(`/ExpensePayments/IdExpensePayment=${ids[5]}/unpay`)).status).toBe(406)
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    IdAccount: number
    /** O débito que nasce com a conta: a forma de pagamento sem fatura */
    IdDebit: number
    /** Categoria é obrigatória em todo gasto, então todo arranjo já nasce com uma */
    IdCategory: number
}

//  Um usuário novo com conta e débito prontos. Cada teste arruma o seu, porque saldo é soma de
//  tudo que existe na conta — reaproveitar workspace faria um teste enxergar a perna do outro.
async function buildWorkspace(): Promise<TestWorkspace> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    let account = await client.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 1000 })

    let list = await client.get(`/Accounts`)
    let methods = list.body.find((item: { IdAccount: number }) => item.IdAccount === account.body.IdAccount).PaymentMethods
    let category = await client.post(`/Categories`, { Description: "Categoria do teste" })

    return {
        user,
        client,
        IdAccount: account.body.IdAccount,
        IdDebit: methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod,
        IdCategory: category.body.IdCategory,
    }
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

async function createCard(workspace: TestWorkspace) {
    let response = await workspace.client.post(`/PaymentMethods`, {
        IdAccount: workspace.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: 28,
        ClosingOffsetDays: 8,
    })

    return response.body.IdPaymentMethod as number
}

//  O corpo mínimo de um gasto: uma perna no débito fechando com o total. O `Paid` é atalho de
//  arranjo — na rota ele mora dentro da perna.
function buildBody(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let { Paid, IdPaymentMethod, ...rest } = overrides

    return {
        Description: "Gasto de teste",
        TotalValue: 100,
        IdCategory: workspace.IdCategory,
        ExpenseDate: "2026-08-10",
        Payments: [{
            IdPaymentMethod: IdPaymentMethod ?? workspace.IdDebit,
            Value: overrides.TotalValue ?? 100,
            Paid: Boolean(Paid),
        }],
        ...rest,
    }
}

async function createExpense(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let response = await workspace.client.post(`/Expenses`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number }
}

//  600 em 6x no cartão: seis pernas de 100, cada uma com a fatura dela. É o arranjo que mostra
//  que quitar é por perna — parcelar não é privilégio do cartão, mas é nele que ele aparece
//  com as datas de fatura junto.
async function createInstallment(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let card = await createCard(workspace)

    let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
        Description: "Compra parcelada",
        TotalValue: 600,
        Kind: "installment",
        InstallmentTotal: 6,
        IdPaymentMethod: card,
        ...overrides,
    }))

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number }
}

//#endregion

//#region Leitura

//  O saldo sai pela rota de contas: ele não é coluna, é calculado a cada leitura — e sempre
//  até o fim de um mês. Sem ReferenceMonth é o corrente, que é o que a tela abre.
async function accountBalance(workspace: TestWorkspace, ReferenceMonth?: string) {
    let response = await workspace.client.get(ReferenceMonth ? `/Accounts?ReferenceMonth=${ReferenceMonth}` : `/Accounts`)

    return response.body.find((item: { IdAccount: number }) => item.IdAccount === workspace.IdAccount).Balance as number
}

function findExpense(IdExpense: number) {
    return TestDatabase.connection().select("*").from("Expenses").where("IdExpense", IdExpense).first()
}

function findPayments(IdExpense: number) {
    return TestDatabase.connection().select("*").from("ExpensePayments").where("IdExpense", IdExpense).orderBy("IdExpensePayment")
}

//#endregion
