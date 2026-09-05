import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de PaymentMethods. Um describe por rota de PaymentMethods.route.ts.
//
//  A conta é arranjo, não objeto de teste: ela vem pelo POST /Accounts porque é de lá
//  que saem o pix e o débito automáticos, e várias asserções daqui dependem deles existirem
//  do jeito que a rota real cria. Quem testa a conta em si é Accounts.test.ts.

describe("PaymentMethods", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts e PaymentMethods junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos cartões" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("POST /PaymentMethods", () => {

        let user: TestUser
        let workspaceClient: TestClient
        let IdAccount: number

        beforeAll(async () => {
            user = await UsersFactory.create()
            workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta do cartão" })

            IdAccount = created.body.IdAccount
        })

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão roxo",
                Kind: "credit_card",
                DueDay: 28,
                ClosingOffsetDays: 8,
            })

            expect(response.status).toBe(401)
        })

        it("cadastra o cartão de crédito com vencimento e folga de fechamento", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão roxo",
                Kind: "credit_card",
                DueDay: 28,
                ClosingOffsetDays: 8,
            })

            expect(response.status).toBe(200)
            expect(response.body.IdPaymentMethod).toEqual(expect.any(Number))

            let card = await findPaymentMethodById(response.body.IdPaymentMethod)

            expect(card).toMatchObject({
                IdWorkspace: user.workspace.IdWorkspace,
                IdAccount,
                Kind: "credit_card",
                DueDay: 28,
                ClosingOffsetDays: 8,
            })
        })

        //  **Só conta corrente aceita cartão de crédito.** Vale e dinheiro são contas de saldo
        //  fechado, e uma fatura nelas não teria de onde sair: o cartão de crédito é uma
        //  dívida que vence contra uma conta bancária, e é isso que 'checking' significa.
        it("recusa cartão de crédito em conta card", async () => {
            let vale = await workspaceClient.post(`/Accounts`, { Name: "Vale Alimentação", Type: "card" })

            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount: vale.body.IdAccount,
                Name: "Cartão no vale",
                Kind: "credit_card",
                DueDay: 28,
            })

            expect(response.status).toBe(406)
            //  A conta continua com a forma única com que nasceu
            expect(await findPaymentMethods(vale.body.IdAccount)).toHaveLength(1)
        })

        //  É regra nova para o cash também, e não só para o tipo que está nascendo: até aqui
        //  nada impedia um credit_card numa conta de dinheiro, e fazer a regra valer para um e
        //  não para o outro a deixaria arbitrária — a razão é a mesma nos dois.
        it("recusa cartão de crédito em conta cash", async () => {
            let carteira = await workspaceClient.post(`/Accounts`, { Name: "Carteira", Type: "cash" })

            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount: carteira.body.IdAccount,
                Name: "Cartão na carteira",
                Kind: "credit_card",
                DueDay: 28,
            })

            expect(response.status).toBe(406)
            expect(await findPaymentMethods(carteira.body.IdAccount)).toHaveLength(1)
        })

        //  E na corrente segue criando, exatamente como antes: a regra nova não pode encostar
        //  no caminho que já funcionava
        it("segue aceitando cartão de crédito em conta checking", async () => {
            let corrente = await workspaceClient.post(`/Accounts`, { Name: "Outra corrente", Type: "checking" })

            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount: corrente.body.IdAccount,
                Name: "Cartão da corrente",
                Kind: "credit_card",
                DueDay: 28,
            })

            expect(response.status).toBe(200)
            expect((await findPaymentMethodById(response.body.IdPaymentMethod)).Kind).toBe("credit_card")
        })

        //  Os dois campos saíram do modelo: nenhuma regra do sistema lia qualquer um deles, e
        //  quem identifica o cartão na tela é o Name. Mandá-los tem que falhar alto — um
        //  cliente antigo que continuasse enviando acharia que a bandeira ficou gravada.
        it("recusa Brand e LastDigits no corpo", async () => {
            for (let field of [{ Brand: "Mastercard" }, { LastDigits: "4321" }]) {
                let response = await workspaceClient.post(`/PaymentMethods`, {
                    IdAccount,
                    Name: "Cartão roxo",
                    Kind: "credit_card",
                    DueDay: 28,
                    ...field,
                })

                expect(response.status).toBe(406)
            }
        })

        //  O GET /Accounts embute a forma de pagamento importando o paymentMethodResponse
        //  daqui, em vez de redescrever a linha: tirar os campos de um lugar tira dos dois.
        //  É este expect que prova isso, e é por ele que a conta não precisou ser tocada.
        it("não devolve Brand nem LastDigits na forma embutida em GET /Accounts", async () => {
            let created = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão sem bandeira",
                Kind: "credit_card",
                DueDay: 28,
            })

            expect(created.status).toBe(200)

            let accounts = await workspaceClient.get(`/Accounts`)
            let methods = accounts.body.flatMap((account: { PaymentMethods: object[] }) => account.PaymentMethods)

            expect(methods.length).toBeGreaterThan(0)

            for (let method of methods) {
                expect(method).not.toHaveProperty("Brand")
                expect(method).not.toHaveProperty("LastDigits")
            }
        })

        //  Pix e débito nascem com a conta: um segundo "pix" da mesma conta duplicaria a
        //  forma de pagamento que o resto do modelo trata como única
        it("recusa cadastrar pix ou débito", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Outro pix",
                Kind: "pix",
            })

            expect(response.status).toBe(406)
        })

        //  O vencimento decide em qual fatura a compra cai: sem ele, a etapa 5 não tem como
        //  calcular a data de vencimento da perna do gasto
        it("recusa cartão sem vencimento", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão sem fatura",
                Kind: "credit_card",
            })

            expect(response.status).toBe(406)
        })

        //  A folga é o único dos dois que o usuário pode não saber de cabeça — pedir um número
        //  que ele teria que deduzir foi o que fez o modelo anterior aceitar dado inventado.
        //  7 dias é o valor mais comum entre os emissores.
        it("assume 7 dias de folga quando o cadastro não manda", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão sem folga informada",
                Kind: "credit_card",
                DueDay: 10,
            })

            expect(response.status).toBe(200)
            expect(await findPaymentMethodById(response.body.IdPaymentMethod)).toMatchObject({ DueDay: 10, ClosingOffsetDays: 7 })
        })

        //  Uma folga maior que o mês jogaria o fechamento para antes da fatura anterior
        it("recusa folga de fechamento fora de 1..28", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão",
                Kind: "credit_card",
                DueDay: 10,
                ClosingOffsetDays: 45,
            })

            expect(response.status).toBe(406)
        })

        it("recusa dia de vencimento fora de 1..31", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão",
                Kind: "credit_card",
                DueDay: 45,
            })

            expect(response.status).toBe(406)
        })

        //  O IdAccount chega pelo body e é sequencial: sem a leitura escopada dava para
        //  pendurar um cartão na conta de outro tenant
        it("recusa pendurar o cartão em conta de outro workspace", async () => {
            let response = await otherClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão invasor",
                Kind: "credit_card",
                DueDay: 15,
                ClosingOffsetDays: 10,
            })

            expect(response.status).toBe(406)

            let methods = await findPaymentMethods(IdAccount)

            expect(methods.some((item) => item.Name === "Cartão invasor")).toBe(false)
        })
    })

    describe("PUT /PaymentMethods/IdPaymentMethod=:IdPaymentMethod", () => {

        let user: TestUser
        let workspaceClient: TestClient
        let IdAccount: number
        let IdCard: number

        beforeAll(async () => {
            user = await UsersFactory.create()
            workspaceClient = new TestClient(user.token)

            let account = await workspaceClient.post(`/Accounts`, { Name: "Conta" })
            IdAccount = account.body.IdAccount

            let card = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão",
                Kind: "credit_card",
                DueDay: 20,
                ClosingOffsetDays: 10,
            })
            IdCard = card.body.IdPaymentMethod
        })

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, { Name: "X" })

            expect(response.status).toBe(401)
        })

        it("recusa forma de pagamento de outro workspace", async () => {
            let response = await otherClient.put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, { Name: "Invadido" })

            expect(response.status).toBe(406)
        })

        it("edita o cartão", async () => {
            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, {
                Name: "Cartão renomeado",
                DueDay: 25,
                ClosingOffsetDays: 10,
                Color: "#00FF00",
            })

            expect(response.status).toBe(200)

            let card = await findPaymentMethodById(IdCard)

            expect(card).toMatchObject({ Name: "Cartão renomeado", DueDay: 25, ClosingOffsetDays: 10, Color: "#00FF00" })
        })

        //  O banco não tem CHECK para isso: um pix com DueDay gravado só apareceria lá na
        //  etapa 5, como vencimento de fatura em cima de um pagamento à vista
        it("recusa vencimento e folga de fechamento em pix", async () => {
            let [pix] = await findPaymentMethods(IdAccount)

            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${pix.IdPaymentMethod}`, {
                Name: "Pix",
                DueDay: 20,
                ClosingOffsetDays: 10,
            })

            expect(response.status).toBe(406)

            let unchanged = await findPaymentMethodById(pix.IdPaymentMethod)

            expect(unchanged.ClosingOffsetDays).toBeNull()
        })

        it("aceita renomear o pix sem tocar nos campos de cartão", async () => {
            let [pix] = await findPaymentMethods(IdAccount)

            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${pix.IdPaymentMethod}`, {
                Name: "Pix da conta",
            })

            expect(response.status).toBe(200)
            expect((await findPaymentMethodById(pix.IdPaymentMethod)).Name).toBe("Pix da conta")
        })

        //  Apagar a folga de um cartão não é edição parcial: é deixar a compra sem fatura
        it("recusa apagar a folga de fechamento de um cartão", async () => {
            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, {
                Name: "Cartão",
                ClosingOffsetDays: null,
            })

            expect(response.status).toBe(406)
        })

        //  Trocar o Kind mudaria a regra de fatura de todas as compras já lançadas nele
        it("recusa trocar o Kind", async () => {
            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, {
                Name: "Cartão",
                Kind: "pix",
            })

            expect(response.status).toBe(406)
        })
    })

    describe("DELETE /PaymentMethods/IdPaymentMethod=:IdPaymentMethod", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/PaymentMethods/IdPaymentMethod=1`)

            expect(response.status).toBe(401)
        })

        it("recusa forma de pagamento inexistente", async () => {
            let response = await client.delete(`/PaymentMethods/IdPaymentMethod=999999`)

            expect(response.status).toBe(406)
        })

        //  Soft delete: ExpensePayments aponta para cá com ON DELETE RESTRICT, então a perna
        //  do gasto continua sabendo em que cartão a compra foi feita
        it("arquiva a forma de pagamento sem apagar a linha", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let account = await workspaceClient.post(`/Accounts`, { Name: "Conta" })

            let card = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount: account.body.IdAccount,
                Name: "Cartão a arquivar",
                Kind: "credit_card",
                DueDay: 10,
                ClosingOffsetDays: 7,
            })

            let response = await workspaceClient.delete(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`)

            expect(response.status).toBe(200)

            let archived = await findPaymentMethodById(card.body.IdPaymentMethod)

            expect(archived).toBeDefined()
            expect(archived.Active).toBe(false)
        })
    })

    describe("POST /PaymentMethods/IdPaymentMethod=:IdPaymentMethod/payInvoice", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/PaymentMethods/IdPaymentMethod=1/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/PaymentMethods/IdPaymentMethod=1/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(406)
        })

        it("recusa corpo sem DueDate", async () => {
            let invoice = await buildInvoice()

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, {})

            expect(response.status).toBe(406)
        })

        //  O id chega do cliente e é sequencial: sem o escopo daria para quitar a fatura do
        //  vizinho e mexer no saldo dele
        it("recusa a fatura de outro workspace", async () => {
            let invoice = await buildInvoice()

            let response = await otherClient.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(406)
            expect(await paidLegs(invoice.IdCard)).toHaveLength(0)
        })

        //  Pagar a fatura move dinheiro, e o viewer só lê
        it("recusa membro viewer", async () => {
            let invoice = await buildInvoice()
            let viewerClient = await buildViewerClient(invoice.IdWorkspace)

            let response = await viewerClient.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(403)
        })

        //  Fora do cartão não há fatura: o débito e o pix saem no ato, e quem quita é a linha
        it("recusa fatura em forma de pagamento que não é cartão", async () => {
            let invoice = await buildInvoice()

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdDebit}/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(406)
        })

        //  **Fatura sem perna nenhuma não é fatura paga, é fatura que não existe.** Mesmo
        //  cuidado que o ExpenseStatus tem com o `every` sobre lista vazia
        it("recusa vencimento que não tem fatura", async () => {
            let invoice = await buildInvoice()

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2027-05-28" })

            expect(response.status).toBe(406)
        })

        //  **O teste que a etapa existe para permitir.** Três compras na mesma fatura, uma
        //  chamada: o saldo desce uma vez só e cada gasto tem o Status recalculado.
        it("quita todas as pernas do vencimento e desce o saldo uma vez só", async () => {
            let invoice = await buildInvoice()

            expect(await balanceOf(invoice.client, invoice.IdAccount, "2026-08")).toBe(1000)

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(200)
            expect(response.body.Payments).toBe(3)

            //  600 = 100 + 200 + 300, as três compras do ciclo
            expect(await balanceOf(invoice.client, invoice.IdAccount, "2026-08")).toBe(400)

            //  40 pernas podem ser 40 gastos diferentes: cada um é recalculado na mesma janela
            for (let IdExpense of invoice.IdExpenses) {
                expect((await findExpense(IdExpense)).Status).toBe("paid")
            }
        })

        //  **Pernas já pagas são puladas**, então repetir a chamada é inofensivo — e é isso que
        //  resolve o caso real de lançar hoje uma compra esquecida de uma fatura já paga
        it("quita só o que faltava quando chamada de novo", async () => {
            let invoice = await buildInvoice()

            await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            //  A compra esquecida, lançada depois de a fatura já ter sido paga
            let late = await createCardExpense(invoice, 50)

            let again = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            expect(again.status).toBe(200)
            //  Uma só: as três anteriores foram puladas
            expect(again.body.Payments).toBe(1)
            expect((await findExpense(late)).Status).toBe("paid")
            expect(await balanceOf(invoice.client, invoice.IdAccount, "2026-08")).toBe(350)
        })

        //  Cancelar um gasto já é o estorno dele: a fatura não pode tirar da conta o dinheiro de
        //  uma compra que não existe mais
        it("ignora a perna de gasto cancelado", async () => {
            let invoice = await buildInvoice()

            await invoice.client.delete(`/Expenses/IdExpense=${invoice.IdExpenses[0]}`)

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            expect(response.body.Payments).toBe(2)
            //  1000 − 200 − 300: os 100 do cancelado não saem
            expect(await balanceOf(invoice.client, invoice.IdAccount, "2026-08")).toBe(500)
        })
    })

    describe("POST /PaymentMethods/IdPaymentMethod=:IdPaymentMethod/unpayInvoice", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/PaymentMethods/IdPaymentMethod=1/unpayInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(401)
        })

        //  Existe pelo mesmo motivo que o unpay, e mais ainda: um clique errado aqui tira
        //  quarenta pagamentos do saldo de uma vez
        it("devolve a fatura inteira, com saldo e status", async () => {
            let invoice = await buildInvoice()

            await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/payInvoice`, { DueDate: "2026-08-28" })

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/unpayInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(200)
            expect(response.body.Payments).toBe(3)
            expect(await balanceOf(invoice.client, invoice.IdAccount, "2026-08")).toBe(1000)

            for (let IdExpense of invoice.IdExpenses) {
                expect((await findExpense(IdExpense)).Status).toBe("pending")
            }

            //  E o instante do pagamento vai junto: uma perna em aberto com PaidAt preenchido
            //  seria um recibo de pagamento que não aconteceu
            expect(await paidLegs(invoice.IdCard)).toHaveLength(0)
        })

        //  Ao contrário do unpay da perna, repetir não é 406: a fatura é um lote, e um lote em
        //  que nada mudou é uma resposta legítima
        it("responde zero quando a fatura já está em aberto", async () => {
            let invoice = await buildInvoice()

            let response = await invoice.client.post(`/PaymentMethods/IdPaymentMethod=${invoice.IdCard}/unpayInvoice`, { DueDate: "2026-08-28" })

            expect(response.status).toBe(200)
            expect(response.body.Payments).toBe(0)
        })
    })

    describe("Fluxo end to end", () => {

        //  A vida inteira de um cartão, só por HTTP e sempre lido pelo GET da conta — que é
        //  onde o cliente enxerga as formas de pagamento, já que esta feature não tem GET
        it("cadastra, edita e arquiva o cartão, e a conta reflete cada passo", async () => {
            let user = await UsersFactory.createClient()
            let IdWorkspace = user.workspace.IdWorkspace

            let account = await user.client.post(`/Accounts`, { Name: "Conta corrente" })

            //  A conta já nasce com as duas formas automáticas, sem nenhuma data de fatura
            let born = await readMethods(user.client, IdWorkspace)

            expect(born.map((item) => item.Kind)).toEqual(["pix", "debit"])

            let card = await user.client.post(`/PaymentMethods`, {
                IdAccount: account.body.IdAccount,
                Name: "Cartão principal",
                Kind: "credit_card",
                DueDay: 28,
                ClosingOffsetDays: 8,
            })

            expect(card.status).toBe(200)

            let withCard = await readMethods(user.client, IdWorkspace)

            expect(withCard.map((item) => item.Kind)).toEqual(["pix", "debit", "credit_card"])
            //  Só o cartão carrega as datas de fatura: é o que a etapa 5 vai ler para saber
            //  em qual fatura a compra cai
            expect(withCard.filter((item) => item.DueDay !== null)).toHaveLength(1)
            expect(withCard.find((item) => item.Kind === "credit_card")).toMatchObject({ Name: "Cartão principal", DueDay: 28, ClosingOffsetDays: 8 })

            expect((await user.client.put(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`, {
                Name: "Cartão do dia a dia",
                DueDay: 12,
                ClosingOffsetDays: 6,
            })).status).toBe(200)

            let edited = await readMethods(user.client, IdWorkspace)

            expect(edited.find((item) => item.Kind === "credit_card")).toMatchObject({ Name: "Cartão do dia a dia", DueDay: 12, ClosingOffsetDays: 6 })

            expect((await user.client.delete(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`)).status).toBe(200)

            //  Sumiu da escolha, mas a linha continua no banco para o histórico apontar
            expect((await readMethods(user.client, IdWorkspace)).map((item) => item.Kind)).toEqual(["pix", "debit"])
            expect(await findPaymentMethodById(card.body.IdPaymentMethod)).toMatchObject({ Active: false })
        })
    })
})

interface MethodResponse {
    IdPaymentMethod: number
    Name: string
    Kind: string
    DueDay: number | null
    ClosingOffsetDays: number | null
}

//  Esta feature não tem GET: a forma de pagamento é sempre lida embutida na conta
async function readMethods(client: TestClient, IdWorkspace: number): Promise<MethodResponse[]> {
    let response = await client.get(`/Accounts`)

    return response.body[0].PaymentMethods
}

interface TestInvoice {
    client: TestClient
    IdWorkspace: number
    IdAccount: number
    IdCard: number
    IdDebit: number
    IdCategory: number
    /** As três compras do ciclo de 28/08: 100, 200 e 300 */
    IdExpenses: number[]
}

//  Um cartão com **três compras na mesma fatura**, que é o arranjo que a rota existe para
//  atender: uma fatura de cartão concentrador tem dezenas de linhas, e o `pay` de uma perna por
//  vez nunca daria conta. As três caem no ciclo de 28/08 porque compram antes do fechamento
//  (dia 20) do mesmo mês.
async function buildInvoice(): Promise<TestInvoice> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    let account = await client.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 1000 })
    let methods = (await client.get(`/Accounts`)).body[0].PaymentMethods
    let category = await client.post(`/Categories`, { Description: "Categoria do teste" })

    let card = await client.post(`/PaymentMethods`, {
        IdAccount: account.body.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: 28,
        ClosingOffsetDays: 8,
    })

    let invoice: TestInvoice = {
        client,
        IdWorkspace: user.workspace.IdWorkspace,
        IdAccount: account.body.IdAccount,
        IdCard: card.body.IdPaymentMethod,
        IdDebit: methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod,
        IdCategory: category.body.IdCategory,
        IdExpenses: [],
    }

    for (let Value of [100, 200, 300]) {
        invoice.IdExpenses.push(await createCardExpense(invoice, Value))
    }

    return invoice
}

//  Uma compra no cartão, no ciclo de 28/08. Sem Paid: no cartão ele não vem do corpo — quem
//  quita é a fatura.
async function createCardExpense(invoice: TestInvoice, Value: number) {
    let response = await invoice.client.post(`/Expenses`, {
        Description: `Compra de ${Value}`,
        TotalValue: Value,
        IdCategory: invoice.IdCategory,
        ExpenseDate: "2026-08-10",
        Payments: [{ IdPaymentMethod: invoice.IdCard, Value }],
    })

    expect(response.status).toBe(200)

    return response.body.IdExpense as number
}

//  Um segundo usuário matriculado como viewer. Não há rota de convite nesta suíte, então a
//  matrícula vai direto ao banco — sem ela o assertRole desta rota nunca seria exercitado.
async function buildViewerClient(IdWorkspace: number) {
    let viewer = await UsersFactory.create({ Name: "Convidado só de leitura" })

    await TestDatabase.connection()
        .insert({ IdWorkspace, IdUser: viewer.user.IdUser, Role: "viewer" })
        .into("WorkspaceMembers")

    return new TestClient(UsersFactory.buildToken(viewer.user.IdUser, IdWorkspace))
}

//  O saldo sai pela rota de contas: não é coluna, é somado dos lançamentos a cada leitura, e
//  sempre até o fim de um mês.
async function balanceOf(client: TestClient, IdAccount: number, ReferenceMonth: string) {
    let response = await client.get(`/Accounts?ReferenceMonth=${ReferenceMonth}`)

    expect(response.status).toBe(200)

    return response.body.find((item: { IdAccount: number }) => item.IdAccount === IdAccount).Balance as number
}

function findExpense(IdExpense: number) {
    return TestDatabase.connection().select("*").from("Expenses").where("IdExpense", IdExpense).first()
}

function paidLegs(IdPaymentMethod: number) {
    return TestDatabase.connection().select("*").from("ExpensePayments").where("IdPaymentMethod", IdPaymentMethod).where("Paid", true)
}

function findPaymentMethods(IdAccount: number, Active = true) {
    return TestDatabase.connection().select("*").from("PaymentMethods").where("IdAccount", IdAccount).where("Active", Active).orderBy("IdPaymentMethod")
}

function findPaymentMethodById(IdPaymentMethod: number) {
    return TestDatabase.connection().select("*").from("PaymentMethods").where("IdPaymentMethod", IdPaymentMethod).first()
}
