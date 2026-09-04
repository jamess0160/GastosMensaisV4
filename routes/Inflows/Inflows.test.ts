import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Inflows. Um describe por rota de Inflows.route.ts, mais o fluxo end to
//  end no fim.
//
//  É a primeira feature de movimento, então metade dos casos aqui é sobre as duas coisas que o
//  modelo não deixa o banco garantir: as regras do Kind (entrada tem uma conta, transferência
//  tem duas e diferentes) e o rateio que precisa fechar exatamente com o total. A outra metade
//  é o saldo — que não é coluna nenhuma, é calculado dos lançamentos a cada leitura.

describe("Inflows", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts, Persons e Inflows junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono das entradas" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /Inflows", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Inflows`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Inflows`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Inflows`)

            expect(response.status).toBe(406)
        })

        it("devolve lista vazia quando o workspace não tem entrada", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Inflows`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        it("devolve as entradas do workspace em ordem de competência", async () => {
            let workspace = await buildWorkspace()

            await createInflow(workspace, { Description: "Salário de agosto", CompetenceDate: "2026-08-05" })
            await createInflow(workspace, { Description: "Freela de julho", CompetenceDate: "2026-07-20" })

            let response = await workspace.client.get(`/Inflows`)

            expect(response.body.map((item: { Description: string }) => item.Description)).toEqual(["Freela de julho", "Salário de agosto"])
        })

        //  O recorte por período é o mesmo formato de Expenses: From/To inclusivos nas duas
        //  pontas, sobre a competência
        it("filtra pelo período From/To, incluindo as duas pontas", async () => {
            let workspace = await buildWorkspace()

            await createInflow(workspace, { Description: "Antes", CompetenceDate: "2026-07-31" })
            await createInflow(workspace, { Description: "Primeiro dia", CompetenceDate: "2026-08-01" })
            await createInflow(workspace, { Description: "Último dia", CompetenceDate: "2026-08-31" })
            await createInflow(workspace, { Description: "Depois", CompetenceDate: "2026-09-01" })

            let response = await workspace.client.get(`/Inflows?From=2026-08-01&To=2026-08-31`)

            expect(response.body.map((item: { Description: string }) => item.Description)).toEqual(["Primeiro dia", "Último dia"])
        })

        it("filtra por Status e por Kind", async () => {
            let workspace = await buildWorkspace()

            let received = await createInflow(workspace, { Description: "Recebida" })
            await createInflow(workspace, { Description: "Pendente" })
            await createTransfer(workspace, { Description: "Transferência" })

            await workspace.client.post(`/Inflows/IdInflow=${received.IdInflow}/receive`)

            expect((await workspace.client.get(`/Inflows?Status=received`)).body.map(description)).toEqual(["Recebida"])
            expect((await workspace.client.get(`/Inflows?Kind=transfer`)).body.map(description)).toEqual(["Transferência"])
            expect((await workspace.client.get(`/Inflows?Kind=inflow`)).body.map(description)).toEqual(["Recebida", "Pendente"])
        })

        //  Cancelada é lixo, não histórico de tela: sai da lista por padrão, mas continua
        //  alcançável quando o cliente pede explicitamente
        it("esconde a cancelada por padrão e a devolve com Status=canceled", async () => {
            let workspace = await buildWorkspace()

            let canceled = await createInflow(workspace, { Description: "Cancelada" })
            await createInflow(workspace, { Description: "Viva" })

            await workspace.client.delete(`/Inflows/IdInflow=${canceled.IdInflow}`)

            expect((await workspace.client.get(`/Inflows`)).body.map(description)).toEqual(["Viva"])
            expect((await workspace.client.get(`/Inflows?Status=canceled`)).body.map(description)).toEqual(["Cancelada"])
        })

        it("não devolve a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createInflow(owner, { Description: "Salário do vizinho" })

            let response = await otherClient.get(`/Inflows`)

            expect(response.body.map(description)).not.toContain("Salário do vizinho")
        })
    })

    describe("GET /Inflows/IdInflow=:IdInflow", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Inflows/IdInflow=1`)

            expect(response.status).toBe(401)
        })

        it("recusa entrada inexistente", async () => {
            let response = await client.get(`/Inflows/IdInflow=999999`)

            expect(response.status).toBe(406)
        })

        //  O IdInflow é sequencial: sem o filtro de workspace no getUnique, a matrícula
        //  conferida no próprio tenant liberaria a leitura do lançamento do vizinho
        it("recusa a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createInflow(owner, { Description: "Salário do vizinho" })

            let response = await otherClient.get(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(response.status).toBe(406)
        })

        it("devolve a entrada com o rateio", async () => {
            let workspace = await buildWorkspace()
            let child = await createPerson(workspace, "Filha")

            let created = await createInflow(workspace, {
                Description: "Salário",
                TotalValue: 300,
                Persons: [
                    { IdPerson: workspace.user.person.IdPerson, Value: 200 },
                    { IdPerson: child, Value: 100 },
                ],
            })

            let response = await workspace.client.get(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(response.status).toBe(200)
            expect(response.body.Persons).toHaveLength(2)
            expect(response.body.Persons.map((item: { Value: number }) => item.Value)).toEqual([200, 100])
        })
    })

    describe("POST /Inflows", () => {

        it("recusa sem token", async () => {
            //  Corpo válido de propósito: o validador de schema roda antes da autenticação
            //  (AsyncHandler com requireToken=false), então um corpo vazio responderia 406 sem
            //  nem chegar na parte que este teste quer provar
            let response = await client.anonymous().post(`/Inflows`, {
                Description: "Entrada",
                TotalValue: 10,
                IdToAccount: 1,
                CompetenceDate: "2026-08-10",
            })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem descrição, valor ou competência", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, { IdToAccount: workspace.IdAccount })

            expect(response.status).toBe(406)
        })

        //  Entrada de valor zero ou negativo é saída, e saída é gasto
        it("recusa valor zero ou negativo", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, { TotalValue: -10 }))

            expect(response.status).toBe(406)
        })

        //  O IdAccount é sequencial e chega do cliente: sem a leitura escopada dava para
        //  depositar na conta de outro tenant e ler o saldo dela depois
        it("recusa conta de outro workspace", async () => {
            let owner = await buildWorkspace()
            let intruder = await buildWorkspace()

            let response = await intruder.client.post(`/Inflows`, buildBody(intruder, { IdToAccount: owner.IdAccount }))

            expect(response.status).toBe(406)
        })

        it("recusa conta arquivada", async () => {
            let workspace = await buildWorkspace()

            await workspace.client.delete(`/Accounts/IdAccount=${workspace.IdAccount}`)

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace))

            expect(response.status).toBe(406)
        })

        //  As duas regras do Kind, que o CHECK do banco garante com 500 e o Joi/section com 406
        it("recusa entrada com conta de origem", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                Kind: "inflow",
                IdFromAccount: workspace.IdAccount,
            }))

            expect(response.status).toBe(406)
        })

        it("recusa transferência sem conta de origem", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, { Kind: "transfer" }))

            expect(response.status).toBe(406)
        })

        it("recusa transferência entre a mesma conta", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                Kind: "transfer",
                IdFromAccount: workspace.IdAccount,
                IdToAccount: workspace.IdAccount,
            }))

            expect(response.status).toBe(406)
        })

        //  Ratear entre contas próprias uma transferência não significa nada: o dinheiro não
        //  mudou de dono
        it("recusa rateio em transferência", async () => {
            let workspace = await buildWorkspace()
            let second = await createAccount(workspace, "Poupança")

            let response = await workspace.client.post(`/Inflows`, {
                ...buildBody(workspace, { Kind: "transfer", IdFromAccount: workspace.IdAccount, IdToAccount: second }),
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 100 }],
            })

            expect(response.status).toBe(406)
        })

        //  O invariante que silencia: um rateio que não fecha não quebra nada na hora, só faz
        //  todo relatório por pessoa mostrar menos dinheiro do que entrou
        it("recusa rateio que não fecha com o total", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                TotalValue: 300,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 200 }],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa pessoa de outro workspace no rateio", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: other.person.IdPerson, Value: 100 }],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa a mesma pessoa duas vezes no rateio", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                TotalValue: 100,
                Persons: [
                    { IdPerson: workspace.user.person.IdPerson, Value: 60 },
                    { IdPerson: workspace.user.person.IdPerson, Value: 40 },
                ],
            }))

            expect(response.status).toBe(406)
        })

        //  Nasce pendente: é o recebimento que entra no saldo, e ele é uma ação à parte
        it("cria a entrada pendente com o rateio na mesma transaction", async () => {
            let workspace = await buildWorkspace()
            let child = await createPerson(workspace, "Filha")

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                Description: "Salário",
                TotalValue: 1000,
                CompetenceDate: "2026-08-05",
                ExpectedDate: "2026-08-05",
                Persons: [
                    { IdPerson: workspace.user.person.IdPerson, Value: 700 },
                    { IdPerson: child, Value: 300 },
                ],
            }))

            expect(response.status).toBe(200)

            let inflow = await findInflow(response.body.IdInflow)

            expect(inflow).toMatchObject({
                Description: "Salário",
                TotalValue: 1000,
                Status: "pending",
                Kind: "inflow",
                //  Veio de fora: a coluna existe e fica nula
                IdFromAccount: null,
                IdToAccount: workspace.IdAccount,
                IdUser: workspace.user.user.IdUser,
                ReceivedAt: null,
            })
            //  Data de calendário: sai como veio, sem passar por fuso
            expect(inflow.CompetenceDate).toBe("2026-08-05")

            expect(await findSplit(response.body.IdInflow)).toHaveLength(2)
        })

        it("cria a transferência entre duas contas", async () => {
            let workspace = await buildWorkspace()
            let second = await createAccount(workspace, "Poupança")

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace, {
                Description: "Guardando",
                Kind: "transfer",
                IdFromAccount: workspace.IdAccount,
                IdToAccount: second,
            }))

            expect(response.status).toBe(200)
            expect(await findInflow(response.body.IdInflow)).toMatchObject({
                Kind: "transfer",
                IdFromAccount: workspace.IdAccount,
                IdToAccount: second,
            })
        })

        it("aceita entrada sem rateio nenhum", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows`, buildBody(workspace))

            expect(response.status).toBe(200)
            expect(await findSplit(response.body.IdInflow)).toHaveLength(0)
        })
    })

    describe("POST /Inflows/batch", () => {

        //  Corpo válido de propósito: o schema Joi roda antes do token (AsyncHandler(..., false)
        //  no joiController), então um corpo inválido responderia 406 sem nunca chegar no 401
        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Inflows/batch`, {
                Inflows: [{ Description: "Salário", TotalValue: 100, IdToAccount: 1, CompetenceDate: "2026-08-10" }],
            })

            expect(response.status).toBe(401)
        })

        //  Lote vazio não é "nada a fazer": é chamada montada errada, e responder 200 com lista
        //  vazia esconderia isso do cliente.
        it("recusa lote vazio", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows/batch`, { Inflows: [] })

            expect(response.status).toBe(406)
        })

        it("recusa lote acima de 100 itens", async () => {
            let workspace = await buildWorkspace()

            let Inflows = Array.from({ length: 101 }, (_, index) => buildBody(workspace, { Description: `Renda ${index}` }))

            let response = await workspace.client.post(`/Inflows/batch`, { Inflows })

            expect(response.status).toBe(406)
            expect(await countInflows(workspace)).toBe(0)
        })

        it("cria as três entradas e devolve os três ids", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { Description: "Salário", TotalValue: 3000 }),
                    buildBody(workspace, { Description: "Aluguel recebido", TotalValue: 800 }),
                    buildBody(workspace, { Description: "Freela", TotalValue: 450 }),
                ],
            })

            expect(response.status).toBe(200)
            expect(response.body.IdInflows).toHaveLength(3)

            let created = await Promise.all(response.body.IdInflows.map((IdInflow: number) => findInflow(IdInflow)))

            expect(created.map((item) => item.Description)).toEqual(["Salário", "Aluguel recebido", "Freela"])
            //  Todas nascem pendentes, como no POST avulso: nenhum saldo se move na gravação, e
            //  é isso que torna a operação segura de repetir
            expect(created.every((item) => item.Status === "pending")).toBe(true)
            expect(await accountBalance(workspace)).toBe(1000)
        })

        //  Cada item é o MESMO corpo do POST avulso, validado pelo MESMO schema: o rateio vem
        //  junto e fecha com o total, como sozinho
        it("grava o rateio de cada item", async () => {
            let workspace = await buildWorkspace()
            let maria = await createPerson(workspace, "Maria")

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { TotalValue: 300, Persons: [{ IdPerson: maria, Value: 300 }] }),
                    buildBody(workspace, { TotalValue: 200 }),
                ],
            })

            expect(response.status).toBe(200)
            expect(await findSplit(response.body.IdInflows[0])).toHaveLength(1)
            expect(await findSplit(response.body.IdInflows[1])).toHaveLength(0)
        })

        //  **O teste da etapa.** Tudo ou nada: o item 2 derruba os 3, e o banco fica no estado
        //  em que estava. É por isso que o miolo passou a receber a transaction.
        it("derruba o lote inteiro quando um item não fecha o rateio", async () => {
            let workspace = await buildWorkspace()
            let maria = await createPerson(workspace, "Maria do lote")

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { Description: "Primeira" }),
                    buildBody(workspace, { Description: "Segunda", TotalValue: 200, Persons: [{ IdPerson: maria, Value: 150 }] }),
                    buildBody(workspace, { Description: "Terceira" }),
                ],
            })

            expect(response.status).toBe(406)
            expect(await countInflows(workspace)).toBe(0)
        })

        //  "O rateio não fecha com o total", sem dizer qual das linhas, é um erro que o usuário
        //  não consegue consertar — ele teria que conferir todas à mão
        it("diz qual item foi recusado", async () => {
            let workspace = await buildWorkspace()
            let maria = await createPerson(workspace, "Maria do índice")

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { Description: "Primeira" }),
                    buildBody(workspace, { Description: "Segunda", TotalValue: 200, Persons: [{ IdPerson: maria, Value: 150 }] }),
                ],
            })

            expect(response.status).toBe(406)
            expect(response.body.msg).toContain("Item 2")
        })

        //  A conta chega do cliente e é sequencial: o lote não pode ser a porta de trás por onde
        //  se lança na conta do vizinho
        it("derruba o lote quando um item aponta para a conta de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let other = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { Description: "Legítima" }),
                    buildBody(workspace, { Description: "Da conta alheia", IdToAccount: other.IdAccount }),
                ],
            })

            expect(response.status).toBe(406)
            expect(await countInflows(workspace)).toBe(0)
            expect(await countInflows(other)).toBe(0)
        })

        //  O que é 406 sozinho é 406 no lote: o schema é o mesmo, e é essa a decisão inteira
        it("recusa um item com corpo inválido, sem gravar os outros", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace),
                    buildBody(workspace, { TotalValue: -50 }),
                ],
            })

            expect(response.status).toBe(406)
            expect(await countInflows(workspace)).toBe(0)
        })

        //  Transferência é um Kind da mesma tabela, então cabe no mesmo lote
        it("aceita transferência junto com entrada no mesmo lote", async () => {
            let workspace = await buildWorkspace()
            let second = await createAccount(workspace, "Poupança do lote")

            let response = await workspace.client.post(`/Inflows/batch`, {
                Inflows: [
                    buildBody(workspace, { Description: "Salário" }),
                    buildBody(workspace, {
                        Description: "Para a poupança",
                        Kind: "transfer",
                        IdFromAccount: workspace.IdAccount,
                        IdToAccount: second,
                    }),
                ],
            })

            expect(response.status).toBe(200)

            let created = await Promise.all(response.body.IdInflows.map((IdInflow: number) => findInflow(IdInflow)))

            expect(created.map((item) => item.Kind)).toEqual(["inflow", "transfer"])
        })
    })

    describe("PUT /Inflows/IdInflow=:IdInflow", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Inflows/IdInflow=1`, buildUpdateBody())

            expect(response.status).toBe(401)
        })

        it("recusa entrada inexistente", async () => {
            let response = await client.put(`/Inflows/IdInflow=999999`, buildUpdateBody())

            expect(response.status).toBe(406)
        })

        it("recusa a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createInflow(owner, { Description: "Salário do vizinho" })

            let response = await otherClient.put(`/Inflows/IdInflow=${created.IdInflow}`, buildUpdateBody())

            expect(response.status).toBe(406)
            expect((await findInflow(created.IdInflow)).Description).toBe("Salário do vizinho")
        })

        //  Mudar o Kind ou a conta reescreveria o que o lançamento significa, e o saldo das
        //  contas envolvidas junto: nem entram no schema
        it("recusa Kind ou conta no corpo", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, {
                ...buildUpdateBody(),
                IdToAccount: workspace.IdAccount,
            })

            expect(response.status).toBe(406)
        })

        it("recusa Status no corpo", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, {
                ...buildUpdateBody(),
                Status: "received",
            })

            expect(response.status).toBe(406)
        })

        it("edita descrição, valor e competência", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { Description: "Salário", TotalValue: 1000 })

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, {
                Description: "Salário corrigido",
                TotalValue: 1200,
                CompetenceDate: "2026-08-06",
            })

            expect(response.status).toBe(200)
            expect(await findInflow(created.IdInflow)).toMatchObject({
                Description: "Salário corrigido",
                TotalValue: 1200,
                CompetenceDate: "2026-08-06",
            })
        })

        it("substitui o rateio inteiro quando o corpo o traz", async () => {
            let workspace = await buildWorkspace()
            let child = await createPerson(workspace, "Filha")

            let created = await createInflow(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 100 }],
            })

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, {
                ...buildUpdateBody({ TotalValue: 100 }),
                Persons: [
                    { IdPerson: workspace.user.person.IdPerson, Value: 60 },
                    { IdPerson: child, Value: 40 },
                ],
            })

            expect(response.status).toBe(200)

            let split = await findSplit(created.IdInflow)

            expect(split).toHaveLength(2)
            expect(split.map((item) => item.Value)).toEqual([60, 40])
        })

        //  O invariante é conferido mesmo sem o rateio no corpo: quando só o total muda, é o
        //  rateio antigo que deixa de fechar
        it("recusa mudar o total deixando o rateio gravado sem fechar", async () => {
            let workspace = await buildWorkspace()

            let created = await createInflow(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 100 }],
            })

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, buildUpdateBody({ TotalValue: 150 }))

            expect(response.status).toBe(406)
            expect((await findInflow(created.IdInflow)).TotalValue).toBe(100)
        })

        it("mantém o rateio gravado quando o corpo não o traz", async () => {
            let workspace = await buildWorkspace()

            let created = await createInflow(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 100 }],
            })

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, buildUpdateBody({
                Description: "Só o nome",
                TotalValue: 100,
            }))

            expect(response.status).toBe(200)
            expect(await findSplit(created.IdInflow)).toHaveLength(1)
        })

        //  É o que a decisão de não guardar saldo compra: não há cache para corrigir, o extrato
        //  é recalculado da linha na próxima leitura
        it("permite editar uma entrada já recebida", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { TotalValue: 100 })

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, buildUpdateBody({ TotalValue: 250 }))

            expect(response.status).toBe(200)
            expect(await accountBalance(workspace)).toBe(1250)
        })

        //  Cancelada é estado terminal: editar seria ressuscitar pela porta dos fundos
        it("recusa editar entrada cancelada", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            let response = await workspace.client.put(`/Inflows/IdInflow=${created.IdInflow}`, buildUpdateBody())

            expect(response.status).toBe(406)
        })
    })

    describe("POST /Inflows/IdInflow=:IdInflow/receive", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Inflows/IdInflow=1/receive`)

            expect(response.status).toBe(401)
        })

        it("recusa entrada inexistente", async () => {
            let response = await client.post(`/Inflows/IdInflow=999999/receive`)

            expect(response.status).toBe(406)
        })

        it("recusa a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createInflow(owner)

            let response = await otherClient.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(response.status).toBe(406)
            expect((await findInflow(created.IdInflow)).Status).toBe("pending")
        })

        it("marca como recebida e grava o instante", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(response.status).toBe(200)

            let inflow = await findInflow(created.IdInflow)

            expect(inflow.Status).toBe("received")
            expect(inflow.ReceivedAt).not.toBeNull()
        })

        //  Receber de novo reescreveria a data em que o dinheiro caiu
        it("recusa receber duas vezes", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(response.status).toBe(406)
        })

        it("recusa receber entrada cancelada", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(response.status).toBe(406)
        })

        //  **O saldo estreia aqui.** Não há coluna: o número sai da soma dos lançamentos, e o
        //  pendente não entra nela — é previsão, não saldo.
        it("só entra no saldo depois de recebida", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { TotalValue: 500 })

            expect(await accountBalance(workspace)).toBe(1000)

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(await accountBalance(workspace)).toBe(1500)
        })

        //  Transferência é soma zero para o patrimônio, mas move as duas contas: contar só a
        //  ponta que chegou faria o dinheiro nascer a cada movimentação
        it("move as duas contas na transferência recebida", async () => {
            let workspace = await buildWorkspace()
            let second = await createAccount(workspace, "Poupança")

            let created = await createTransfer(workspace, { TotalValue: 400, IdToAccount: second })

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            let accounts = await listAccounts(workspace)

            expect(accounts[workspace.IdAccount]).toBe(600)
            expect(accounts[second]).toBe(400)
            //  Soma zero: o patrimônio não mudou
            expect(accounts[workspace.IdAccount] + accounts[second]).toBe(1000)
        })
    })

    describe("POST /Inflows/IdInflow=:IdInflow/unreceive", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Inflows/IdInflow=1/unreceive`)

            expect(response.status).toBe(401)
        })

        it("recusa entrada inexistente", async () => {
            let response = await client.post(`/Inflows/IdInflow=999999/unreceive`)

            expect(response.status).toBe(406)
        })

        it("recusa a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createInflow(owner)

            await owner.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            let response = await otherClient.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect(response.status).toBe(406)
            expect((await findInflow(created.IdInflow)).Status).toBe("received")
        })

        //  **O expect do saldo é o teste da etapa.** O documento do front pedia "retirar do
        //  saldo o que o receive creditou"; não há o que retirar, porque o saldo nunca é
        //  gravado — ele é somado dos lançamentos 'received' a cada leitura. Voltar o Status
        //  para 'pending' É a retirada, e é este `expect` que prova que está certo.
        it("volta para pendente, limpa o ReceivedAt e o saldo volta ao valor anterior", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { TotalValue: 500 })

            expect(await accountBalance(workspace)).toBe(1000)

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(await accountBalance(workspace)).toBe(1500)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect(response.status).toBe(200)

            let inflow = await findInflow(created.IdInflow)

            expect(inflow.Status).toBe("pending")
            //  O ReceivedAt volta a null junto: guardar a data de um recebimento desfeito
            //  deixaria a linha dizendo duas coisas ao mesmo tempo
            expect(inflow.ReceivedAt).toBeNull()

            expect(await accountBalance(workspace)).toBe(1000)
        })

        it("recusa desfazer duas vezes", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)
            expect((await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)).status).toBe(200)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect(response.status).toBe(406)
        })

        it("recusa desfazer o que nunca foi recebido", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect(response.status).toBe(406)
        })

        //  Cancelada saiu do fluxo: não se recebe nem se desfaz recebimento dela
        it("recusa desfazer entrada cancelada", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)
            await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            let response = await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect(response.status).toBe(406)
        })

        //  A transferência move as duas contas na ida; desfazer tem que devolver as duas
        it("devolve as duas contas ao desfazer uma transferência", async () => {
            let workspace = await buildWorkspace()
            let second = await createAccount(workspace, "Poupança")

            let created = await createTransfer(workspace, { TotalValue: 400, IdToAccount: second })

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)
            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            let accounts = await listAccounts(workspace)

            expect(accounts[workspace.IdAccount]).toBe(1000)
            expect(accounts[second]).toBe(0)
        })

        //  Receber de novo depois de desfazer é o caso normal: quem errou o clique conserta e
        //  segue. O ReceivedAt novo é o do segundo recebimento, que é o que de fato aconteceu.
        it("permite receber de novo depois de desfeito", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { TotalValue: 500 })

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)
            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/unreceive`)

            expect((await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)).status).toBe(200)

            expect((await findInflow(created.IdInflow)).ReceivedAt).not.toBeNull()
            expect(await accountBalance(workspace)).toBe(1500)
        })
    })

    describe("DELETE /Inflows/IdInflow=:IdInflow", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Inflows/IdInflow=1`)

            expect(response.status).toBe(401)
        })

        it("recusa entrada inexistente", async () => {
            let response = await client.delete(`/Inflows/IdInflow=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa a entrada de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createInflow(owner)

            let response = await otherClient.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(response.status).toBe(406)
            expect((await findInflow(created.IdInflow)).Status).toBe("pending")
        })

        //  Não há Active nesta tabela nem delete físico: a linha fica, com Status='canceled'
        it("cancela sem apagar a linha", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            let response = await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(response.status).toBe(200)

            let inflow = await findInflow(created.IdInflow)

            expect(inflow).toBeDefined()
            expect(inflow.Status).toBe("canceled")
        })

        //  O estorno: como o saldo é calculado, a linha simplesmente sai da soma
        it("tira do saldo ao cancelar uma entrada recebida", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace, { TotalValue: 500 })

            await workspace.client.post(`/Inflows/IdInflow=${created.IdInflow}/receive`)

            expect(await accountBalance(workspace)).toBe(1500)

            await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(await accountBalance(workspace)).toBe(1000)
        })

        it("recusa cancelar duas vezes", async () => {
            let workspace = await buildWorkspace()
            let created = await createInflow(workspace)

            await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            let response = await workspace.client.delete(`/Inflows/IdInflow=${created.IdInflow}`)

            expect(response.status).toBe(406)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passo 5 do "como saber que a leva acabou" do ROADMAP, só por HTTP: lança o salário,
        //  recebe, transfere entre contas e confere que os números fecham
        it("cadastra, lança o salário, recebe, transfere e os saldos fecham", async () => {
            let payload = {
                Name: "Usuário do fluxo de entradas",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            let checking = await flowClient.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 200 })
            let savings = await flowClient.post(`/Accounts`, { Name: "Poupança", InitialBalance: 0 })

            //  A pessoa do dono já existe desde o cadastro: dá para ratear sem cadastrar nada
            let persons = await flowClient.get(`/Persons`)

            expect(persons.body).toHaveLength(1)

            let salary = await flowClient.post(`/Inflows`, {
                Description: "Salário de agosto",
                TotalValue: 3000,
                IdToAccount: checking.body.IdAccount,
                CompetenceDate: "2026-08-05",
                Persons: [{ IdPerson: persons.body[0].IdPerson, Value: 3000 }],
            })

            expect(salary.status).toBe(200)

            //  Lançado não é recebido: o saldo continua o de abertura
            expect((await balanceOf(flowClient, checking.body.IdAccount))).toBe(200)

            expect((await flowClient.post(`/Inflows/IdInflow=${salary.body.IdInflow}/receive`)).status).toBe(200)
            expect((await balanceOf(flowClient, checking.body.IdAccount))).toBe(3200)

            let transfer = await flowClient.post(`/Inflows`, {
                Description: "Guardando um pedaço",
                TotalValue: 1200,
                Kind: "transfer",
                IdFromAccount: checking.body.IdAccount,
                IdToAccount: savings.body.IdAccount,
                CompetenceDate: "2026-08-06",
            })

            expect(transfer.status).toBe(200)
            expect((await flowClient.post(`/Inflows/IdInflow=${transfer.body.IdInflow}/receive`)).status).toBe(200)

            //  Os dois lados da transferência, e o patrimônio inalterado
            expect(await balanceOf(flowClient, checking.body.IdAccount)).toBe(2000)
            expect(await balanceOf(flowClient, savings.body.IdAccount)).toBe(1200)

            //  A lista do mês traz as duas, e o detalhe traz o rateio
            let month = await flowClient.get(`/Inflows?From=2026-08-01&To=2026-08-31`)

            expect(month.body).toHaveLength(2)

            let detail = await flowClient.get(`/Inflows/IdInflow=${salary.body.IdInflow}`)

            expect(detail.body.Persons).toHaveLength(1)
            expect(detail.body.Persons[0].Value).toBe(3000)

            //  Estorno: cancelar a transferência devolve o dinheiro para a conta de origem
            expect((await flowClient.delete(`/Inflows/IdInflow=${transfer.body.IdInflow}`)).status).toBe(200)

            expect(await balanceOf(flowClient, checking.body.IdAccount)).toBe(3200)
            expect(await balanceOf(flowClient, savings.body.IdAccount)).toBe(0)
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    /** Conta corrente com 1000 de saldo de abertura, para o saldo ter de onde partir */
    IdAccount: number
}

//  Um usuário novo com uma conta pronta: o mínimo para lançar qualquer entrada. Cada teste
//  arruma o seu, porque saldo é soma de tudo que existe na conta — reaproveitar workspace entre
//  testes faria um teste enxergar o lançamento do outro.
async function buildWorkspace(): Promise<TestWorkspace> {
    let user = await UsersFactory.create()
    let client = new TestClient(user.token)

    let account = await client.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 1000 })

    return { user, client, IdAccount: account.body.IdAccount }
}

function createAccount(workspace: TestWorkspace, Name: string) {
    return workspace.client.post(`/Accounts`, { Name, InitialBalance: 0 }).then((response) => response.body.IdAccount as number)
}

function createPerson(workspace: TestWorkspace, Name: string) {
    return workspace.client.post(`/Persons`, { Name }).then((response) => response.body.IdPerson as number)
}

function buildBody(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    return {
        Description: "Entrada de teste",
        TotalValue: 100,
        IdToAccount: workspace.IdAccount,
        CompetenceDate: "2026-08-10",
        ...overrides,
    }
}

function buildUpdateBody(overrides: Record<string, unknown> = {}) {
    return {
        Description: "Entrada editada",
        TotalValue: 100,
        CompetenceDate: "2026-08-10",
        ...overrides,
    }
}

async function createInflow(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/Inflows`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdInflow: number }
}

async function createTransfer(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let IdToAccount = overrides.IdToAccount ?? await createAccount(workspace, `Destino ${Date.now()}`)

    return await createInflow(workspace, {
        Kind: "transfer",
        IdFromAccount: workspace.IdAccount,
        ...overrides,
        IdToAccount,
    })
}

//#endregion

//#region Leitura

function description(item: { Description: string }) {
    return item.Description
}

//  O saldo sai pela rota de contas: ele não é coluna, é calculado a cada leitura
async function accountBalance(workspace: TestWorkspace) {
    return await balanceOf(workspace.client, workspace.IdAccount)
}

async function balanceOf(client: TestClient, IdAccount: number) {
    let response = await client.get(`/Accounts`)

    return response.body.find((item: { IdAccount: number }) => item.IdAccount === IdAccount).Balance as number
}

async function listAccounts(workspace: TestWorkspace) {
    let response = await workspace.client.get(`/Accounts`)

    return Object.fromEntries(response.body.map((item: { IdAccount: number, Balance: number }) => [item.IdAccount, item.Balance])) as Record<number, number>
}

async function countInflows(workspace: TestWorkspace) {
    let rows = await TestDatabase.connection().select("*").from("Inflows").where("IdWorkspace", workspace.user.workspace.IdWorkspace)

    return rows.length
}

function findInflow(IdInflow: number) {
    return TestDatabase.connection().select("*").from("Inflows").where("IdInflow", IdInflow).first()
}

function findSplit(IdInflow: number) {
    return TestDatabase.connection().select("*").from("InflowPersons").where("IdInflow", IdInflow).orderBy("IdInflowPerson")
}

//#endregion
