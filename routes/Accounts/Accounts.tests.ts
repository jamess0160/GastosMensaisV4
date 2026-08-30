import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Accounts. Um describe por rota de Accounts.route.ts, mais o fluxo
//  end to end no fim. O cartão de crédito tem suíte própria, em PaymentMethods.tests.ts.
//
//  Esta é a primeira feature escopada por tenant, então metade dos casos aqui é sobre isso: o
//  IdWorkspace chega pela URL e é sequencial, ou seja, chutável. Todo describe tem o caso do
//  workspace alheio — é a falha que um teste feliz nunca encontra.

describe("Accounts", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts e PaymentMethods junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono das contas" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Accounts", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Accounts`)

            expect(response.status).toBe(401)
        })

        //  Sessão autenticada cujo token foi emitido sem workspace — o usuário não tem
        //  matrícula nenhuma. Não é falta de permissão: o conserto é chamar o switch.
        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Accounts`)

            expect(response.status).toBe(406)
        })

        //  Mexer no payload do token quebra a assinatura, e aí nem chega às rotas de tenant:
        //  o acessMiddleware recusa antes. É a diferença entre o token e o cookie de antes.
        it("recusa token com o payload adulterado", async () => {
            let response = await new TestClient(tamperToken(root.token)).get(`/Accounts`)

            expect(response.status).toBe(401)
        })

        //  **O teste que sustenta o assertMember.** O token é assinado de verdade — foi esta
        //  API que o emitiu — mas aponta para um workspace do qual o usuário não é membro.
        //  Só a consulta à matrícula pega isso; a assinatura, sozinha, não pegaria.
        //  406 e não 404: um 404 confirmaria que o workspace existe.
        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Accounts`)

            expect(response.status).toBe(406)
        })

        it("devolve lista vazia quando o workspace não tem conta", async () => {
            let response = await client.get(`/Accounts`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        it("devolve a conta com as formas de pagamento embutidas", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)

            await workspaceClient.post(`/Accounts`, { Name: "Nubank" })

            let response = await workspaceClient.get(`/Accounts`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            expect(response.body[0].Name).toBe("Nubank")
            expect(response.body[0].PaymentMethods.map((item: { Kind: string }) => item.Kind)).toEqual(["pix", "debit"])
        })

        //  O joinTables não filtra nada sozinho: sem o append de Active o cartão arquivado
        //  voltaria na lista como se ainda fosse escolhível
        it("não devolve conta nem forma de pagamento arquivada", async () => {
            let user = await UsersFactory.create()
            let workspaceClient = new TestClient(user.token)
            let IdWorkspace = user.workspace.IdWorkspace

            let visible = await workspaceClient.post(`/Accounts`, { Name: "Conta viva" })
            let archived = await workspaceClient.post(`/Accounts`, { Name: "Conta arquivada" })

            let card = await workspaceClient.post(`/PaymentMethods`, {
                IdAccount: visible.body.IdAccount,
                Name: "Cartão cancelado",
                Kind: "credit_card",
                ClosingDay: 20,
                DueDay: 28,
            })

            await workspaceClient.delete(`/Accounts/IdAccount=${archived.body.IdAccount}`)
            await workspaceClient.delete(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}`)

            let response = await workspaceClient.get(`/Accounts`)

            expect(response.body.map((item: { Name: string }) => item.Name)).toEqual(["Conta viva"])
            expect(response.body[0].PaymentMethods.map((item: { Kind: string }) => item.Kind)).toEqual(["pix", "debit"])
        })
    })

    describe("POST /Accounts", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Accounts`, { Name: "Conta" })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem o Name", async () => {
            let response = await client.post(`/Accounts`, {})

            expect(response.status).toBe(406)
        })

        //  Cartão é forma de pagamento, não conta: o Type só tem checking e cash
        it("recusa conta do tipo credit_card", async () => {
            let response = await client.post(`/Accounts`, { Name: "Cartão", Type: "credit_card" })

            expect(response.status).toBe(406)
        })

        it("recusa cor fora do formato #RRGGBB", async () => {
            let response = await client.post(`/Accounts`, { Name: "Conta", Color: "roxo" })

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.post(`/Accounts`, { Name: "Invadida" })

            expect(response.status).toBe(406)

            let accounts = await findAccounts(root.workspace.IdWorkspace)

            expect(accounts).toHaveLength(0)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/Accounts`, { Name: "Sem workspace" })

            expect(response.status).toBe(406)
        })

        //  A regra do modelo: conta sem forma de pagamento é conta em que não dá para lançar
        //  nada. As duas escritas vão na mesma transaction da criação.
        it("cria a conta e gera pix e débito na mesma transaction", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace

            let response = await new TestClient(user.token).post(`/Accounts`, {
                Name: "Conta corrente",
                Type: "checking",
                Color: "#8A05BE",
                InitialBalance: 1500.5,
                InitialBalanceDate: "2026-08-01",
            })

            expect(response.status).toBe(200)
            expect(response.body.IdAccount).toEqual(expect.any(Number))

            let [account] = await findAccounts(IdWorkspace)

            expect(account).toMatchObject({
                Name: "Conta corrente",
                Type: "checking",
                Color: "#8A05BE",
                InitialBalance: 1500.5,
                IdUser: user.user.IdUser,
                Active: true,
            })
            //  Data de calendário: chega do Postgres como string, sem passar por fuso
            expect(account.InitialBalanceDate).toBe("2026-08-01")

            let methods = await findPaymentMethods(response.body.IdAccount)

            expect(methods.map((item) => item.Kind)).toEqual(["pix", "debit"])
            //  Fatura só existe em cartão
            expect(methods.every((item) => item.ClosingDay === null && item.DueDay === null)).toBe(true)
        })

        it("usa checking e saldo zero como padrão", async () => {
            let user = await UsersFactory.create()

            let response = await new TestClient(user.token).post(`/Accounts`, { Name: "Carteira" })

            let [account] = await findAccounts(user.workspace.IdWorkspace)

            expect(response.status).toBe(200)
            expect(account).toMatchObject({ Type: "checking", InitialBalance: 0, InitialBalanceDate: null })
        })
    })

    describe("PUT /Accounts/IdAccount=:IdAccount", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Accounts/IdAccount=1`, { Name: "X" })

            expect(response.status).toBe(401)
        })

        it("recusa conta inexistente", async () => {
            let response = await client.put(`/Accounts/IdAccount=999999`, { Name: "X" })

            expect(response.status).toBe(406)
        })

        //  O IdAccount é sequencial: sem o filtro de workspace no getUnique, a matrícula
        //  conferida no próprio tenant liberaria a edição da conta do vizinho
        it("recusa a conta de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Accounts`, { Name: "Conta do dono" })

            let response = await otherClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, { Name: "Invadida" })

            expect(response.status).toBe(406)

            let [account] = await findAccounts(owner.workspace.IdWorkspace)

            expect(account.Name).toBe("Conta do dono")
        })

        it("edita nome, cor, ícone e posição", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", Color: "#000000" })

            let response = await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, {
                Name: "Conta principal",
                Color: "#FF0000",
                IconPath: "banco/nubank.svg",
                Position: 3,
            })

            expect(response.status).toBe(200)

            let [account] = await findAccounts(IdWorkspace)

            expect(account).toMatchObject({ Name: "Conta principal", Color: "#FF0000", IconPath: "banco/nubank.svg", Position: 3 })
        })

        //  Edição parcial: o PUT que só renomeia não pode apagar o resto por omissão
        it("não apaga os campos que o corpo não traz", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", Color: "#123456" })

            await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, { Name: "Só o nome" })

            let [account] = await findAccounts(IdWorkspace)

            expect(account).toMatchObject({ Name: "Só o nome", Color: "#123456" })
        })

        it("permite corrigir o saldo inicial enquanto a conta não tem movimento", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", InitialBalance: 100 })

            let response = await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, {
                Name: "Conta",
                InitialBalance: 250.75,
                InitialBalanceDate: "2026-01-31",
            })

            expect(response.status).toBe(200)

            let [account] = await findAccounts(IdWorkspace)

            expect(account.InitialBalance).toBe(250.75)
            expect(account.InitialBalanceDate).toBe("2026-01-31")
        })

        //  O saldo é sempre calculado a partir do saldo de abertura mais os lançamentos.
        //  Mudar a abertura depois do primeiro lançamento reescreveria o saldo histórico por
        //  baixo — o extrato do mês passado mudaria sozinho.
        it("recusa mudar o saldo inicial depois que a conta tem lançamento", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", InitialBalance: 100 })

            await seedInflow(IdWorkspace, created.body.IdAccount)

            let response = await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, {
                Name: "Conta",
                InitialBalance: 999,
            })

            expect(response.status).toBe(406)

            let [account] = await findAccounts(IdWorkspace)

            expect(account.InitialBalance).toBe(100)
        })

        //  Reenviar o mesmo valor não é troca: o cliente que devolve o objeto inteiro no PUT
        //  não pode ser barrado por isso
        it("aceita reenviar o mesmo saldo inicial com a conta já movimentada", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", InitialBalance: 100 })

            await seedInflow(IdWorkspace, created.body.IdAccount)

            let response = await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, {
                Name: "Renomeada",
                InitialBalance: 100,
            })

            expect(response.status).toBe(200)
        })

        //  Entrada cancelada não move saldo nenhum: não há histórico para proteger
        it("não considera entrada cancelada como movimento", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta", InitialBalance: 100 })

            await seedInflow(IdWorkspace, created.body.IdAccount, "canceled")

            let response = await workspaceClient.put(`/Accounts/IdAccount=${created.body.IdAccount}`, {
                Name: "Conta",
                InitialBalance: 500,
            })

            expect(response.status).toBe(200)
        })
    })

    describe("DELETE /Accounts/IdAccount=:IdAccount", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Accounts/IdAccount=1`)

            expect(response.status).toBe(401)
        })

        it("recusa conta inexistente", async () => {
            let response = await client.delete(`/Accounts/IdAccount=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa a conta de outro workspace", async () => {
            let owner = await UsersFactory.create()
            let created = await new TestClient(owner.token).post(`/Accounts`, { Name: "Conta do dono" })

            let response = await otherClient.delete(`/Accounts/IdAccount=${created.body.IdAccount}`)

            expect(response.status).toBe(406)

            let account = await findAccountById(created.body.IdAccount)

            expect(account.Active).toBe(true)
        })

        //  Soft delete e não delete físico: Inflows aponta para Accounts com ON DELETE
        //  RESTRICT nas duas pontas, e o histórico tem que continuar apontando para a conta
        it("arquiva a conta e as formas de pagamento dela", async () => {
            let user = await UsersFactory.create()
            let IdWorkspace = user.workspace.IdWorkspace
            let workspaceClient = new TestClient(user.token)

            let created = await workspaceClient.post(`/Accounts`, { Name: "Conta antiga" })

            let response = await workspaceClient.delete(`/Accounts/IdAccount=${created.body.IdAccount}`)

            expect(response.status).toBe(200)

            let account = await findAccountById(created.body.IdAccount)

            //  A linha continua no banco: só saiu das listas
            expect(account).toBeDefined()
            expect(account.Active).toBe(false)

            let methods = await findPaymentMethods(created.body.IdAccount, false)

            expect(methods).toHaveLength(2)
            expect(methods.every((item) => item.Active === false)).toBe(true)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passos 1 e 2 do "como saber que a leva acabou" do ROADMAP, só por HTTP: do cadastro
        //  do usuário até a conta pronta para receber lançamento. O cartão é o passo 3 e está
        //  no fluxo de PaymentMethods.tests.ts.
        it("cadastra o usuário, cria a conta e lê a lista com pix e débito", async () => {
            let payload = {
                Name: "Usuário do fluxo de contas",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            let created = await new TestClient().post("/Users", payload)

            expect(created.status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            let IdWorkspace = created.body.IdWorkspace

            let account = await flowClient.post(`/Accounts`, {
                Name: "Conta corrente",
                InitialBalance: 2000,
                InitialBalanceDate: "2026-08-01",
            })

            expect(account.status).toBe(200)

            let list = await flowClient.get(`/Accounts`)

            expect(list.status).toBe(200)
            expect(list.body).toHaveLength(1)
            expect(list.body[0]).toMatchObject({
                Name: "Conta corrente",
                InitialBalance: 2000,
                //  Data de calendário: sai como veio, sem passar por fuso
                InitialBalanceDate: "2026-08-01",
            })
            expect(list.body[0].PaymentMethods.map((item: { Kind: string }) => item.Kind)).toEqual(["pix", "debit"])

            //  Com lançamento na conta o saldo de abertura congela: é o que impede o extrato
            //  do mês passado de mudar sozinho
            await seedInflow(IdWorkspace, account.body.IdAccount)

            let frozen = await flowClient.put(`/Accounts/IdAccount=${account.body.IdAccount}`, {
                Name: "Conta corrente",
                InitialBalance: 5000,
            })

            expect(frozen.status).toBe(406)

            //  Renomear continua liberado: o que trava é o saldo de abertura, não a conta
            expect((await flowClient.put(`/Accounts/IdAccount=${account.body.IdAccount}`, { Name: "Conta do Nubank" })).status).toBe(200)

            let renamed = await flowClient.get(`/Accounts`)

            expect(renamed.body[0]).toMatchObject({ Name: "Conta do Nubank", InitialBalance: 2000 })
        })
    })
})

function findAccounts(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("Accounts").where("IdWorkspace", IdWorkspace).where("Active", true).orderBy("IdAccount")
}

function findAccountById(IdAccount: number) {
    return TestDatabase.connection().select("*").from("Accounts").where("IdAccount", IdAccount).first()
}

function findPaymentMethods(IdAccount: number, Active = true) {
    return TestDatabase.connection().select("*").from("PaymentMethods").where("IdAccount", IdAccount).where("Active", Active).orderBy("IdPaymentMethod")
}

//  Inflows ainda não tem rota (etapa 4): a única forma de arranjar uma conta com movimento
//  é semear direto. Assim que a rota existir, este helper vira uma chamada HTTP.
function seedInflow(IdWorkspace: number, IdToAccount: number, Status: "pending" | "received" | "canceled" = "received") {
    return TestDatabase.connection().insert({
        IdWorkspace,
        IdToAccount,
        Description: "Movimento de teste",
        TotalValue: 10,
        Status,
        Kind: "inflow",
        CompetenceDate: "2026-08-10",
    }).into("Inflows")
}

//  Troca o IdWorkspace dentro do payload e remonta o token sem reassinar: é exatamente o que
//  um cliente mal-intencionado consegue fazer, e é o que a assinatura existe para barrar.
function tamperToken(token: string) {
    let [header, payload, signature] = token.split(".")

    let decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))

    decoded.IdWorkspace = decoded.IdWorkspace + 1

    let forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url")

    return `${header}.${forged}.${signature}`
}
