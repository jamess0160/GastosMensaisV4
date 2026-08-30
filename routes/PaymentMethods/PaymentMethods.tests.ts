import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de PaymentMethods. Um describe por rota de PaymentMethods.route.ts.
//
//  A conta é arranjo, não objeto de teste: ela vem pelo POST /Accounts porque é de lá
//  que saem o pix e o débito automáticos, e várias asserções daqui dependem deles existirem
//  do jeito que a rota real cria. Quem testa a conta em si é Accounts.tests.ts.

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
                ClosingDay: 20,
                DueDay: 28,
                Brand: "Mastercard",
                LastDigits: "4321",
            })

            expect(response.status).toBe(401)
        })

        it("cadastra o cartão de crédito com fechamento e vencimento", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão roxo",
                Kind: "credit_card",
                ClosingDay: 20,
                DueDay: 28,
                Brand: "Mastercard",
                LastDigits: "4321",
            })

            expect(response.status).toBe(200)
            expect(response.body.IdPaymentMethod).toEqual(expect.any(Number))

            let card = await findPaymentMethodById(response.body.IdPaymentMethod)

            expect(card).toMatchObject({
                IdWorkspace: user.workspace.IdWorkspace,
                IdAccount,
                Kind: "credit_card",
                ClosingDay: 20,
                DueDay: 28,
                Brand: "Mastercard",
                LastDigits: "4321",
            })
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

        //  ClosingDay/DueDay decidem em qual fatura a compra cai: sem eles, a etapa 5 não
        //  tem como calcular a data de vencimento da perna do gasto
        it("recusa cartão sem fechamento e vencimento", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão sem fatura",
                Kind: "credit_card",
            })

            expect(response.status).toBe(406)
        })

        it("recusa dia de fechamento fora de 1..31", async () => {
            let response = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount,
                Name: "Cartão",
                Kind: "credit_card",
                ClosingDay: 45,
                DueDay: 10,
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
                ClosingDay: 5,
                DueDay: 15,
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
                ClosingDay: 10,
                DueDay: 20,
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
                ClosingDay: 15,
                DueDay: 25,
                Color: "#00FF00",
            })

            expect(response.status).toBe(200)

            let card = await findPaymentMethodById(IdCard)

            expect(card).toMatchObject({ Name: "Cartão renomeado", ClosingDay: 15, DueDay: 25, Color: "#00FF00" })
        })

        //  O banco não tem CHECK para isso: um pix com DueDay gravado só apareceria lá na
        //  etapa 5, como vencimento de fatura em cima de um pagamento à vista
        it("recusa fechamento e vencimento em pix", async () => {
            let [pix] = await findPaymentMethods(IdAccount)

            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${pix.IdPaymentMethod}`, {
                Name: "Pix",
                ClosingDay: 10,
                DueDay: 20,
            })

            expect(response.status).toBe(406)

            let unchanged = await findPaymentMethodById(pix.IdPaymentMethod)

            expect(unchanged.ClosingDay).toBeNull()
        })

        it("aceita renomear o pix sem tocar nos campos de cartão", async () => {
            let [pix] = await findPaymentMethods(IdAccount)

            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${pix.IdPaymentMethod}`, {
                Name: "Pix da conta",
            })

            expect(response.status).toBe(200)
            expect((await findPaymentMethodById(pix.IdPaymentMethod)).Name).toBe("Pix da conta")
        })

        //  Apagar o fechamento de um cartão não é edição parcial: é deixar a compra sem fatura
        it("recusa apagar o fechamento de um cartão", async () => {
            let response = await workspaceClient.put(`/PaymentMethods/IdPaymentMethod=${IdCard}`, {
                Name: "Cartão",
                ClosingDay: null,
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
                ClosingDay: 1,
                DueDay: 10,
            })

            let response = await workspaceClient.delete(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`)

            expect(response.status).toBe(200)

            let archived = await findPaymentMethodById(card.body.IdPaymentMethod)

            expect(archived).toBeDefined()
            expect(archived.Active).toBe(false)
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
                ClosingDay: 20,
                DueDay: 28,
                LastDigits: "1234",
            })

            expect(card.status).toBe(200)

            let withCard = await readMethods(user.client, IdWorkspace)

            expect(withCard.map((item) => item.Kind)).toEqual(["pix", "debit", "credit_card"])
            //  Só o cartão carrega as datas de fatura: é o que a etapa 5 vai ler para saber
            //  em qual fatura a compra cai
            expect(withCard.filter((item) => item.ClosingDay !== null)).toHaveLength(1)
            expect(withCard.find((item) => item.Kind === "credit_card")).toMatchObject({ Name: "Cartão principal", ClosingDay: 20, DueDay: 28 })

            expect((await user.client.put(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`, {
                Name: "Cartão do dia a dia",
                ClosingDay: 5,
                DueDay: 12,
            })).status).toBe(200)

            let edited = await readMethods(user.client, IdWorkspace)

            expect(edited.find((item) => item.Kind === "credit_card")).toMatchObject({ Name: "Cartão do dia a dia", ClosingDay: 5, DueDay: 12 })

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
    ClosingDay: number | null
    DueDay: number | null
}

//  Esta feature não tem GET: a forma de pagamento é sempre lida embutida na conta
async function readMethods(client: TestClient, IdWorkspace: number): Promise<MethodResponse[]> {
    let response = await client.get(`/Accounts`)

    return response.body[0].PaymentMethods
}

function findPaymentMethods(IdAccount: number, Active = true) {
    return TestDatabase.connection().select("*").from("PaymentMethods").where("IdAccount", IdAccount).where("Active", Active).orderBy("IdPaymentMethod")
}

function findPaymentMethodById(IdPaymentMethod: number) {
    return TestDatabase.connection().select("*").from("PaymentMethods").where("IdPaymentMethod", IdPaymentMethod).first()
}
