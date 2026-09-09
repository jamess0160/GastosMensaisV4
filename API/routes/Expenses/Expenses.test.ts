import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Expenses — as etapas 5, 6 e 7, que são o mesmo POST com Kind diferente.
//  Um describe por rota, mais o fluxo end to end no fim.
//
//  Três coisas carregam a suíte, e nenhuma delas o banco garante:
//
//  1. **os dois eixos não se misturam** — 2 formas de pagamento e 2 pessoas dão 2 + 2 linhas;
//  2. **Status é derivado** das pernas, e só chega a 'paid' quando todas estão pagas;
//  3. **a soma fecha** — das pernas e do rateio, cada uma com o total, até o centavo.

describe("Expenses", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient
    //  Categoria é obrigatória em todo corpo de gasto, inclusive nos que nem chegam à section
    let rootCategory: number

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts, Persons, Tags e Expenses junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos gastos" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)

        rootCategory = (await client.post(`/Categories`, { Description: "Categoria da raiz" })).body.IdCategory
    })

    describe("GET /Expenses", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Expenses`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Expenses`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Expenses`)

            expect(response.status).toBe(406)
        })

        it("devolve lista vazia quando o workspace não tem gasto", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Expenses`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        //  Mesmo formato de período das entradas: From/To inclusivos nas duas pontas
        it("filtra pelo período, por status e por categoria", async () => {
            let workspace = await buildWorkspace()
            let category = await createCategory(workspace, "Mercado")

            await createExpense(workspace, { Description: "Antes", ExpenseDate: "2026-07-31" })
            await createExpense(workspace, { Description: "No mês", ExpenseDate: "2026-08-10", IdCategory: category })
            let paid = await createExpense(workspace, { Description: "Pago", ExpenseDate: "2026-08-11", Paid: true })

            expect((await workspace.client.get(`/Expenses?From=2026-08-01&To=2026-08-31`)).body.map(description)).toEqual(["No mês", "Pago"])
            expect((await workspace.client.get(`/Expenses?IdCategory=${category}`)).body.map(description)).toEqual(["No mês"])
            expect((await workspace.client.get(`/Expenses?Status=paid`)).body.map(description)).toEqual(["Pago"])
            expect(paid.IdExpense).toEqual(expect.any(Number))
        })

        it("esconde o cancelado por padrão e o devolve com Status=canceled", async () => {
            let workspace = await buildWorkspace()

            let canceled = await createExpense(workspace, { Description: "Cancelado" })
            await createExpense(workspace, { Description: "Vivo" })

            await workspace.client.delete(`/Expenses/IdExpense=${canceled.IdExpense}`)

            expect((await workspace.client.get(`/Expenses`)).body.map(description)).toEqual(["Vivo"])
            expect((await workspace.client.get(`/Expenses?Status=canceled`)).body.map(description)).toEqual(["Cancelado"])
        })

        //  O filtro de status multi-seleção da tela: "em aberto **e** cancelado" numa consulta
        //  só. É o IncludeCanceled que permite isso — com Status a lista sempre é de um estado.
        it("devolve o cancelado junto com o resto quando IncludeCanceled=true", async () => {
            let workspace = await buildWorkspace()

            let canceled = await createExpense(workspace, { Description: "Cancelado" })
            await createExpense(workspace, { Description: "Vivo" })

            await workspace.client.delete(`/Expenses/IdExpense=${canceled.IdExpense}`)

            let response = await workspace.client.get(`/Expenses?IncludeCanceled=true`)

            expect(response.status).toBe(200)
            expect(response.body.map(description).sort()).toEqual(["Cancelado", "Vivo"])
            //  false é a resposta de hoje, byte a byte: nada que já existe quebra.
            expect((await workspace.client.get(`/Expenses?IncludeCanceled=false`)).body.map(description)).toEqual(["Vivo"])
        })

        //  Status continua sendo o recorte de um estado só — IncludeCanceled não o afrouxa.
        it("mantém o recorte do Status quando os dois vêm juntos", async () => {
            let workspace = await buildWorkspace()

            let canceled = await createExpense(workspace, { Description: "Cancelado" })
            await createExpense(workspace, { Description: "Vivo" })

            await workspace.client.delete(`/Expenses/IdExpense=${canceled.IdExpense}`)

            expect((await workspace.client.get(`/Expenses?Status=pending&IncludeCanceled=true`)).body.map(description)).toEqual(["Vivo"])
        })

        it("recusa IncludeCanceled que não é booleano", async () => {
            let response = await client.get(`/Expenses?IncludeCanceled=talvez`)

            expect(response.status).toBe(406)
        })

        it("não devolve o gasto de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createExpense(owner, { Description: "Gasto do vizinho" })

            expect((await otherClient.get(`/Expenses`)).body.map(description)).not.toContain("Gasto do vizinho")
        })
    })

    describe("GET /Expenses/IdExpense=:IdExpense", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Expenses/IdExpense=1`)

            expect(response.status).toBe(401)
        })

        it("recusa gasto inexistente", async () => {
            let response = await client.get(`/Expenses/IdExpense=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa o gasto de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner)

            let response = await otherClient.get(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(response.status).toBe(406)
        })

        //  **O teste que sustenta o modelo:** duas formas de pagamento e duas pessoas são
        //  2 + 2 linhas. Se algum dia der 4, o produto cartesiano voltou.
        it("devolve os dois eixos em listas separadas, 2 + 2 e nunca 4", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)
            let child = await createPerson(workspace, "Filha")

            let created = await createExpense(workspace, {
                TotalValue: 100,
                Payments: [
                    { IdPaymentMethod: workspace.IdDebit, Value: 60 },
                    { IdPaymentMethod: card, Value: 40 },
                ],
                Persons: [
                    { IdPerson: workspace.user.person.IdPerson, Value: 70 },
                    { IdPerson: child, Value: 30 },
                ],
                Tags: ["Viagem"],
            })

            let response = await workspace.client.get(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(response.status).toBe(200)
            expect(response.body.Payments).toHaveLength(2)
            expect(response.body.Persons).toHaveLength(2)
            expect(response.body.Tags).toHaveLength(1)
        })
    })

    describe("POST /Expenses", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Expenses`, {
                Description: "Gasto",
                TotalValue: 10,
                IdCategory: rootCategory,
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: 1, Value: 10 }],
            })

            expect(response.status).toBe(401)
        })

        it("recusa gasto sem forma de pagamento", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, {
                Description: "Sem perna",
                TotalValue: 10,
                IdCategory: workspace.IdCategory,
                ExpenseDate: "2026-08-10",
                Payments: [],
            })

            expect(response.status).toBe(406)
        })

        it("recusa forma de pagamento de outro workspace", async () => {
            let owner = await buildWorkspace()
            let intruder = await buildWorkspace()

            let response = await intruder.client.post(`/Expenses`, buildBody(intruder, {
                Payments: [{ IdPaymentMethod: owner.IdDebit, Value: 100 }],
            }))

            expect(response.status).toBe(406)
        })

        //  Categoria e pessoa chegam como id, que é sequencial e chutável. A tag não entra
        //  nesta lista: ela chega como texto, e texto sempre vira uma tag do próprio workspace.
        it("recusa categoria ou pessoa de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let stranger = await buildWorkspace()

            let category = await createCategory(stranger, "Categoria do vizinho")

            expect((await workspace.client.post(`/Expenses`, buildBody(workspace, { IdCategory: category }))).status).toBe(406)
            expect((await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Persons: [{ IdPerson: stranger.user.person.IdPerson, Value: 100 }],
            }))).status).toBe(406)
        })

        //  Categoria obrigatória: gasto sem ela vira linha que nenhum relatório soma
        it("recusa gasto sem categoria", async () => {
            let workspace = await buildWorkspace()

            let { IdCategory, ...body } = buildBody(workspace)

            expect((await workspace.client.post(`/Expenses`, body)).status).toBe(406)
        })

        //  Cada eixo fecha com o total por conta própria. O que não fecha não quebra nada na
        //  hora: só faz o saldo divergir, ou o relatório por pessoa mentir.
        it("recusa eixo financeiro que não fecha com o total", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: 100,
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 90 }],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa eixo analítico que não fecha com o total", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 90 }],
            }))

            expect(response.status).toBe(406)
        })

        it("cria o gasto simples pendente com as duas pernas", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Description: "Mercado",
                TotalValue: 250.5,
                ExpenseDate: "2026-08-10",
            }))

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ IdExpense: expect.any(Number), Occurrences: 1 })

            let expense = await findExpense(response.body.IdExpense)

            expect(expense).toMatchObject({
                Description: "Mercado",
                TotalValue: 250.5,
                Kind: "single",
                //  Derivado das pernas: nenhuma paga, então pendente
                Status: "pending",
                IdParentExpense: null,
                RecurrenceDay: null,
            })
            expect(expense.ExpenseDate).toBe("2026-08-10")

            let payments = await findPayments(response.body.IdExpense)

            expect(payments).toHaveLength(1)
            //  Débito não tem fatura: as datas ficam nulas
            expect(payments[0]).toMatchObject({ Value: 250.5, Paid: false, ClosingDate: null, DueDate: null, InstallmentNumber: null })
        })

        //  O débito costuma já sair pago no ato, e o Status derivado tem que acompanhar
        it("nasce pago quando a perna já vem quitada", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, { Paid: true })

            expect((await findExpense(created.IdExpense)).Status).toBe("paid")
        })

        //  A regra que o ROADMAP avisa: um dia de diferença na compra vira um mês no caixa
        it("calcula a fatura do cartão a partir da folga de fechamento", async () => {
            let workspace = await buildWorkspace()
            //  Vence dia 28 e fecha 8 dias antes, ou seja, no dia 20
            let card = await createCard(workspace, { DueDay: 28, ClosingOffsetDays: 8 })

            let before = await createExpense(workspace, {
                ExpenseDate: "2026-08-19",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let after = await createExpense(workspace, {
                ExpenseDate: "2026-08-21",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            //  Comprou antes de fechar: cai na fatura deste mês
            expect((await findPayments(before.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-08-20", DueDate: "2026-08-28" })
            //  Comprou depois: já é a do mês seguinte
            expect((await findPayments(after.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-09-20", DueDate: "2026-09-28" })
        })

        //  **O gasto no cartão já nasce lançado na fatura.** `Charged` quer dizer "está na
        //  fatura", não "já conferi": lançar num cartão é justamente dizer que a compra vai para
        //  a fatura dele. O caso raro — o emissor não registrou — é o que merece o clique, e é o
        //  `uncharge` que existe para ele. `ChargedAt` fica nulo porque não houve clique nenhum.
        it("nasce lançada na fatura, sem instante de conferência", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let [leg] = await findPayments(created.IdExpense)

            expect(leg.Charged).toBe(true)
            expect(leg.ChargedAt).toBeNull()
            //  E nada do que o Paid governa se mexeu: estar na fatura não é ter saído da conta
            expect(leg.Paid).toBe(false)
        })

        //  **A fronteira do fechamento, no dia exato.** O teste acima olha para o dia anterior e
        //  o posterior; o que decide a regra é o próprio dia. A comparação é estritamente maior
        //  (`ExpenseDate > closingOf(...)`), então a compra **no** dia do fechamento ainda entra
        //  na fatura que fecha naquele dia — e a do dia seguinte já é a próxima. Um dia aqui é um
        //  mês no caixa, e é a única linha do arquivo que decide isso.
        it("põe na fatura que fecha no dia a compra feita no próprio dia do fechamento", async () => {
            let workspace = await buildWorkspace()
            //  Vence dia 28 e fecha 8 dias antes: o fechamento cai no dia 20 do mesmo mês
            let card = await createCard(workspace, { DueDay: 28, ClosingOffsetDays: 8 })

            let onClosing = await createExpense(workspace, {
                ExpenseDate: "2026-08-20",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let afterClosing = await createExpense(workspace, {
                ExpenseDate: "2026-08-21",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            //  Comprou no dia em que fechou: entra nessa fatura mesmo
            expect((await findPayments(onClosing.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-08-20", DueDate: "2026-08-28" })
            //  Um dia depois: a fatura seguinte, um mês inteiro adiante no caixa
            expect((await findPayments(afterClosing.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-09-20", DueDate: "2026-09-28" })
        })

        //  A mesma fronteira do outro lado da rolagem: o cartão real que motivou a etapa fecha
        //  dia 27 e vence dia 04 do mês seguinte, ou seja, 8 dias de folga atravessando a virada
        //  do mês. É o caso em que o laço do `creditCardInvoice` roda duas vezes, e por isso o
        //  que vale para o cartão que fecha e vence no mesmo mês tinha que ser verificado aqui
        //  de novo — a compra do dia 27 não pode cair na fatura de outubro.
        it("põe na fatura que fecha no dia a compra do dia do fechamento quando o vencimento rola de mês", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 4, ClosingOffsetDays: 8 })

            let onClosing = await createExpense(workspace, {
                ExpenseDate: "2026-08-27",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let afterClosing = await createExpense(workspace, {
                ExpenseDate: "2026-08-28",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            expect((await findPayments(onClosing.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-08-27", DueDate: "2026-09-04" })
            expect((await findPayments(afterClosing.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-09-26", DueDate: "2026-10-04" })
        })

        //  **O limite conhecido do modelo da folga, escrito como teste.** A folga é uma subtração
        //  de dias corridos a partir do vencimento, e o emissor brasileiro fecha num dia fixo do
        //  mês: as duas descrições coincidem no mês em que o cartão foi cadastrado e discordam
        //  por um dia nos meses em que a distância entre fechamento e vencimento muda. No cartão
        //  de cima — fecha 27, vence 04 —, agosto tem 8 dias de folga (27/08 a 04/09) e setembro
        //  tem 7 (27/09 a 04/10), então o fechamento derivado de setembro cai no dia 26 e a
        //  compra do dia 27 vai para a fatura de novembro, não a de outubro.
        //
        //  Isto não é a comparação errada: é o modelo de descrição do cartão, e trocá-lo é
        //  migration, recálculo de perna já gravada e reescrita desta section — leva própria. O
        //  teste fica para que a troca, quando vier, apareça aqui em vez de passar despercebida.
        it("deriva o fechamento pela folga, que anda um dia quando o intervalo do mês muda", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 4, ClosingOffsetDays: 8 })

            let created = await createExpense(workspace, {
                ExpenseDate: "2026-09-27",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            //  O emissor fecharia em 27/09 e cobraria em 04/10; a folga fecha em 26/09
            expect((await findPayments(created.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-10-27", DueDate: "2026-11-04" })
        })

        //  Vence no dia 5 com folga de 8: a fatura fecha no dia 28 do mês anterior ao próprio
        //  vencimento. No modelo antigo essa relação tinha que ser inferida de dois números
        //  soltos (DueDay <= ClosingDay); aqui ela é só a subtração dando um mês para trás.
        it("fecha no mês anterior quando a folga atravessa a virada do mês", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 5, ClosingOffsetDays: 8 })

            let created = await createExpense(workspace, {
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            expect((await findPayments(created.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-08-28", DueDate: "2026-09-05" })
        })

        //  O caso que derrubou o modelo de dia do mês: com fechamento no dia 30, uma compra do
        //  começo de setembro caía na fatura que vence em **outubro**, porque o vencimento no
        //  dia 10 sempre rolava um mês. Pela folga, o mesmo cartão fecha no dia 3 e a compra do
        //  dia 2 vence ainda em setembro — que é o que o extrato do banco mostra.
        it("mantém no mês a compra feita antes do fechamento de um cartão que vence cedo", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 10, ClosingOffsetDays: 7 })

            let created = await createExpense(workspace, {
                ExpenseDate: "2026-09-02",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            expect((await findPayments(created.IdExpense))[0]).toMatchObject({ ClosingDate: "2026-09-03", DueDate: "2026-09-10" })
        })

        //  **O motivo de a folga existir.** Um fechamento guardado como dia do mês tem que ser
        //  grampeado onde o dia não existe, e aí deixa de bater com a comparação que decide a
        //  fatura. A folga produz sempre uma data real: 05/03 − 7 é 26/02, e fevereiro não tem
        //  tratamento nenhum.
        it("não grampeia o fechamento num mês curto", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 5, ClosingOffsetDays: 7 })

            let before = await createExpense(workspace, {
                ExpenseDate: "2027-02-25",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let after = await createExpense(workspace, {
                ExpenseDate: "2027-02-27",
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            expect((await findPayments(before.IdExpense))[0]).toMatchObject({ ClosingDate: "2027-02-26", DueDate: "2027-03-05" })
            expect((await findPayments(after.IdExpense))[0]).toMatchObject({ ClosingDate: "2027-03-29", DueDate: "2027-04-05" })
        })

        //  Vencimento no dia 31: o mês curto grampeia o vencimento, mas cada parcela é contada
        //  a partir da compra, então o 28 de fevereiro não vira âncora e março volta ao 31.
        it("não arrasta o grampeamento do vencimento de uma parcela para a seguinte", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 31, ClosingOffsetDays: 7 })

            let created = await createExpense(workspace, {
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                ExpenseDate: "2027-01-10",
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            expect((await findPayments(created.IdExpense)).map((item) => item.DueDate))
                .toEqual(["2027-01-31", "2027-02-28", "2027-03-31"])
        })
    })

    describe("POST /Expenses — parcelamento", () => {

        //  600 em 6x são 6 pernas de 100, e o TotalValue continua sendo o total da compra
        it("cria 6 pernas de 100 numa compra de 600 em 6x", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { DueDay: 28, ClosingOffsetDays: 8 })

            let created = await createExpense(workspace, {
                Description: "Notebook",
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: card, Value: 600 }],
            })

            let payments = await findPayments(created.IdExpense)

            expect(payments).toHaveLength(6)
            expect(payments.map((item) => item.Value)).toEqual([100, 100, 100, 100, 100, 100])
            expect(payments.map((item) => item.InstallmentNumber)).toEqual([1, 2, 3, 4, 5, 6])
            expect(payments.every((item) => item.InstallmentTotal === 6)).toBe(true)

            //  Cada parcela na sua fatura, avançando mês a mês
            expect(payments.map((item) => item.DueDate)).toEqual([
                "2026-08-28", "2026-09-28", "2026-10-28", "2026-11-28", "2026-12-28", "2027-01-28",
            ])

            //  O total da compra, não o da parcela
            expect((await findExpense(created.IdExpense)).TotalValue).toBe(600)
        })

        //  100 em 3x não fecha: 33,33 x 3 = 99,99. A sobra vai na primeira parcela, e a soma
        //  bate exatamente com o total — invariante do modelo.
        it("põe a sobra de centavos na primeira parcela", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                TotalValue: 100,
                Kind: "installment",
                InstallmentTotal: 3,
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            })

            let payments = await findPayments(created.IdExpense)

            expect(payments.map((item) => item.Value)).toEqual([33.34, 33.33, 33.33])
            expect(payments.reduce((acc, item) => acc + Math.round(item.Value * 100), 0)).toBe(10000)
        })

        //  **Parcelar não é privilégio do cartão:** carnê, crediário e o racha com um amigo
        //  caem em pix ou débito. Sem fatura não há fechamento — mas o vencimento existe, e é o
        //  mesmo dia dos meses seguintes.
        it("parcela fora do cartão, com vencimento mensal e sem fechamento", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Description: "Carnê da loja",
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 300 }],
            })

            let payments = await findPayments(created.IdExpense)

            expect(payments.map((item) => item.Value)).toEqual([100, 100, 100])
            expect(payments.every((item) => item.ClosingDate === null)).toBe(true)
            expect(payments.map((item) => item.DueDate)).toEqual(["2026-08-10", "2026-09-10", "2026-10-10"])
        })

        //  O dia 31 não existe em todo mês: o vencimento da parcela é grampeado como a
        //  recorrência
        it("grampeia o vencimento da parcela no fim do mês curto", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                ExpenseDate: "2025-12-31",
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 300 }],
            })

            expect((await findPayments(created.IdExpense)).map((item) => item.DueDate)).toEqual([
                "2025-12-31", "2026-01-31", "2026-02-28",
            ])
        })

        it("recusa parcelar em duas formas de pagamento", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Kind: "installment",
                InstallmentTotal: 3,
                TotalValue: 100,
                Payments: [
                    { IdPaymentMethod: card, Value: 60 },
                    { IdPaymentMethod: workspace.IdDebit, Value: 40 },
                ],
            }))

            expect(response.status).toBe(406)
        })

        //  Parcelado em 1x é compra à vista
        it("recusa InstallmentTotal menor que 2", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Kind: "installment",
                InstallmentTotal: 1,
                Payments: [{ IdPaymentMethod: card, Value: 100 }],
            }))

            expect(response.status).toBe(406)
        })

        //  Quitar uma parcela não torna a compra paga: o Status derivado resolve sozinho
        //  No cartão quem quita é a **fatura**, uma por vez: cada parcela cai na sua, e o gasto
        //  só vira 'paid' quando a última delas for paga.
        it("só fica pago depois da última parcela quitada", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            let payments = await findPayments(created.IdExpense)

            for (let index = 0; index < payments.length; index++) {
                await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: payments[index].DueDate })

                let expected = index === payments.length - 1 ? "paid" : "pending"

                expect((await findExpense(created.IdExpense)).Status).toBe(expected)
            }
        })

        //  **Compra no cartão não nasce quitada.** Marcar Paid no lançamento diz que o dinheiro
        //  saiu da conta, e ele não saiu: quem tira é o pagamento da fatura, semanas depois. Era
        //  exatamente isso que deixava o saldo errado.
        it("recusa Paid no lançamento quando a forma é cartão de crédito", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Payments: [{ IdPaymentMethod: card, Value: 100, Paid: true }],
            }))

            expect(response.status).toBe(406)
        })

        //  Fora do cartão continua valendo, e é o caso comum: débito e pix saem no ato
        it("segue aceitando Paid no lançamento em débito", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 100, Paid: true }],
            })

            expect((await findPayments(created.IdExpense))[0].Paid).toBe(true)
            //  E fora do cartão o Charged é nulo: não há fatura em que a cobrança possa entrar
            expect((await findPayments(created.IdExpense))[0].Charged).toBeNull()
        })
    })

    describe("POST /Expenses — gasto fixo", () => {

        //  Corrente de ocorrências reais, não molde + instâncias: toda linha é um gasto
        it("cria a raiz e as ocorrências, todas com suas pernas", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Description: "Aluguel",
                TotalValue: 1500,
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                //  Sem Occurrences no corpo: quem corta a serie antes da janela do servidor
                //  e a data de fim, e ela e a unica das duas que o cliente escolhe.
                RecurrenceEndDate: "2026-10-31",
            })

            expect(created.Occurrences).toBe(3)

            let series = await findSeries(created.IdExpense)

            expect(series).toHaveLength(3)
            //  A raiz é a primeira ocorrência e carrega a recorrência
            expect(series[0]).toMatchObject({ IdParentExpense: null, RecurrenceDay: 5, ExpenseDate: "2026-08-05" })
            //  As seguintes apontam para ela e são gastos de verdade
            expect(series.slice(1).every((item) => item.IdParentExpense === created.IdExpense)).toBe(true)
            expect(series.map((item) => item.ExpenseDate)).toEqual(["2026-08-05", "2026-09-05", "2026-10-05"])
            expect(series.every((item) => item.RecurrenceDay === 5 || item.IdParentExpense !== null)).toBe(true)

            for (let occurrence of series) {
                expect(await findPayments(occurrence.IdExpense)).toHaveLength(1)
            }
        })

        //  A janela é do SERVIDOR, não do corpo: 12 ocorrências contando a raiz. Sem data de
        //  fim é ela que limita a série — a recorrência nunca fica aberta, nem antes ficava.
        //  A tela não precisa saber esse número antes de salvar: pergunta gravando.
        it("cria a janela do servidor quando não há data de fim, e devolve quantas nasceram", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Description: "Streaming",
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
            })

            expect(created.Occurrences).toBe(12)
            expect(await findSeries(created.IdExpense)).toHaveLength(12)
        })

        //  O campo saiu do corpo, e mandá-lo tem que falhar alto: um cliente antigo que
        //  continuasse enviando 60 receberia 12 em silêncio e mostraria o número errado.
        it("recusa Occurrences no corpo", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                Occurrences: 3,
            }))

            expect(response.status).toBe(406)
        })

        //  O dia 31 não existe em todo mês: sem grampear, a recorrência sumiria em fevereiro
        it("grampeia o dia da recorrência no fim do mês curto", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-01-31",
                RecurrenceEndDate: "2026-03-31",
            })

            expect((await findSeries(created.IdExpense)).map((item) => item.ExpenseDate)).toEqual([
                "2026-01-31", "2026-02-28", "2026-03-31",
            ])
        })

        it("para de gerar na data de fim da série", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-10-31",
            })

            expect(created.Occurrences).toBe(3)
        })

        //  A ocorrência do mês que vem não pode nascer quitada
        it("gera as ocorrências futuras em aberto mesmo com a raiz paga", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-10-31",
                Paid: true,
            })

            let series = await findSeries(created.IdExpense)

            expect(series[0].Status).toBe("paid")
            expect(series.slice(1).every((item) => item.Status === "pending")).toBe(true)
        })

        it("recusa gasto fixo em duas formas de pagamento", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                Kind: "fixed",
                TotalValue: 100,
                Payments: [
                    { IdPaymentMethod: card, Value: 60 },
                    { IdPaymentMethod: workspace.IdDebit, Value: 40 },
                ],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa recorrência em gasto que não é fixo", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, { RecurrenceDay: 5 }))

            expect(response.status).toBe(406)
        })
    })

    describe("POST /Expenses — estorno", () => {

        //  **Estorno é gasto com o sinal trocado, e é o lugar certo dele:** ele tem categoria
        //  (é assim que o crédito volta ao orçamento certo), datas de fatura, competência,
        //  rateio por pessoa e linha da fatura. Modelar como qualquer outra coisa significa
        //  reimplementar as cinco.
        it("cria gasto e perna negativos no cartão", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                Description: "Estorno da compra",
                TotalValue: -150,
                Payments: [{ IdPaymentMethod: card, Value: -150 }],
            })

            expect((await findExpense(created.IdExpense)).TotalValue).toBe(-150)

            let [leg] = await findPayments(created.IdExpense)

            expect(leg.Value).toBe(-150)
            //  O estorno cai numa fatura como qualquer compra: as datas saem do mesmo cálculo,
            //  e ele nasce na fatura pelo mesmo motivo que a compra nasce
            expect(leg.DueDate).toBe("2026-08-28")
            expect(leg.Charged).toBe(true)
        })

        //  **A fatura é que encolhe.** Nenhum dinheiro entra na conta num estorno: o que muda é
        //  o que vai sair dela quando a fatura for paga.
        it("faz a fatura do vencimento sair 150 menor", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createExpense(workspace, {
                Description: "Compra",
                TotalValue: 500,
                Payments: [{ IdPaymentMethod: card, Value: 500 }],
            })

            await createExpense(workspace, {
                Description: "Estorno",
                TotalValue: -150,
                Payments: [{ IdPaymentMethod: card, Value: -150 }],
            })

            let invoice = await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: "2026-08-28" })

            expect(invoice.status).toBe(200)
            //  As duas linhas são da mesma fatura, e o estorno é quitado com ela
            expect(invoice.body.Payments).toBe(2)
            //  1000 − (500 − 150): saiu da conta o líquido da fatura
            expect(await accountBalance(workspace)).toBe(650)
        })

        //  Fora do cartão, dinheiro que volta entra na conta de verdade — e para isso já existe
        //  Inflows. É no crédito que o estorno não é entrada nenhuma.
        it("recusa estorno no débito", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: -150,
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: -150 }],
            }))

            expect(response.status).toBe(406)
        })

        //  Cada regra do parcelamento (o centavo que sobra na primeira parcela, as datas mês a
        //  mês) teria que ser reexaminada com o sinal invertido: quem for estornado numa compra
        //  em 6x lança um estorno por parcela.
        it("recusa estorno parcelado", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: -600,
                Kind: "installment",
                InstallmentTotal: 6,
                Payments: [{ IdPaymentMethod: card, Value: -600 }],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa estorno fixo", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: -150,
                Kind: "fixed",
                Payments: [{ IdPaymentMethod: card, Value: -150 }],
            }))

            expect(response.status).toBe(406)
        })

        //  **Um gasto é inteiro positivo ou inteiro negativo.** Sem esta regra dá para montar
        //  uma perna de +200 e outra de −50 fechando em 150: não é compra nem estorno, é um
        //  número sem significado que passa em todas as outras validações.
        it("recusa sinais misturados no eixo financeiro", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: 150,
                Payments: [
                    { IdPaymentMethod: card, Value: 200 },
                    { IdPaymentMethod: workspace.IdDebit, Value: -50 },
                ],
            }))

            expect(response.status).toBe(406)
        })

        it("recusa sinais misturados no rateio", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)
            let maria = await createPerson(workspace, "Maria")
            let joao = await createPerson(workspace, "João")

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: -150,
                Payments: [{ IdPaymentMethod: card, Value: -150 }],
                Persons: [
                    { IdPerson: maria, Value: -200 },
                    { IdPerson: joao, Value: 50 },
                ],
            }))

            expect(response.status).toBe(406)
        })

        //  Zero continua proibido, aqui e no CHECK do banco: gasto de zero não é lançamento
        it("recusa TotalValue zero", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let response = await workspace.client.post(`/Expenses`, buildBody(workspace, {
                TotalValue: 0,
                Payments: [{ IdPaymentMethod: card, Value: 0 }],
            }))

            expect(response.status).toBe(406)
        })

        //  O rateio sobrevive ao sinal sem tocar na fórmula: os valores fecham com o total
        //  negativo do mesmo jeito
        it("aceita rateio negativo fechando com o total", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)
            let maria = await createPerson(workspace, "Maria")

            let created = await createExpense(workspace, {
                TotalValue: -150,
                Payments: [{ IdPaymentMethod: card, Value: -150 }],
                Persons: [{ IdPerson: maria, Value: -150 }],
            })

            expect((await findPersons(created.IdExpense))[0].Value).toBe(-150)
        })

        //  O PUT não muda o Kind, então quem manda é o gravado: virar estorno uma compra
        //  parcelada é a mesma recusa do cadastro
        it("recusa transformar em estorno pelo PUT de uma compra parcelada", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                Payments: [{ IdPaymentMethod: card, Value: 600 }],
            })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, buildUpdateBody(workspace.IdCategory, {
                TotalValue: -600,
            }))

            expect(response.status).toBe(406)
        })
    })

    //  **O cartão que conta como débito.** Duas pessoas usam cartão de dois jeitos
    //  incompatíveis: quem paga a fatura inteira todo mês espera ver a compra de agosto em
    //  agosto; quem usa o cartão como reserva passa nele justamente para pagar no mês seguinte.
    //
    //  O modo governa **uma** coluna, a CompetenceDate da perna — o mês em que ela pesa no
    //  orçamento e no "posso gastar". A CashDate, que é o que move saldo, não muda em modo
    //  nenhum: é sempre o dia em que o dinheiro sai da conta.
    describe("POST /Expenses — CompetenceMode do cartão", () => {

        //  O mesmo dia, o mesmo cartão, dois modos: em 'purchase' a compra pesa em agosto,
        //  em 'invoice' ela pesa em setembro, com a fatura. A CashDate é a mesma nos dois.
        it("conta no mês da compra em 'purchase' e no do vencimento em 'invoice'", async () => {
            let workspace = await buildWorkspace()

            let everyday = await createCard(workspace, { CompetenceMode: "purchase" })
            let deferred = await createCard(workspace, { CompetenceMode: "invoice" })

            //  Compra de 21/08 num cartão que vence no dia 28 com folga de 8: já fechou, então
            //  a fatura é a de setembro
            let onEveryday = await createExpense(workspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: everyday, Value: 100 }] })
            let onDeferred = await createExpense(workspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: deferred, Value: 100 }] })

            expect((await findPayments(onEveryday.IdExpense))[0]).toMatchObject({
                DueDate: "2026-09-28",
                CompetenceDate: "2026-08-21",
                CashDate: "2026-09-28",
            })

            expect((await findPayments(onDeferred.IdExpense))[0]).toMatchObject({
                DueDate: "2026-09-28",
                CompetenceDate: "2026-09-28",
                CashDate: "2026-09-28",
            })
        })

        //  **O teste da etapa.** Se 'purchase' significasse simplesmente CompetenceDate =
        //  ExpenseDate, 600 em 6x jogaria 600 inteiros no mês da compra e mataria a regra "a
        //  parcela pesa 100 por mês", que é a razão de o orçamento somar pernas e não gastos.
        //  O avanço por parcela é o que impede isso — a mesma fórmula do carnê fora do cartão.
        it("dá 100 por mês em 600 num cartão 'purchase', não 600 no primeiro", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { CompetenceMode: "purchase" })

            let created = await createExpense(workspace, {
                TotalValue: 600,
                ExpenseDate: "2026-08-10",
                Kind: "installment",
                InstallmentTotal: 6,
                Payments: [{ IdPaymentMethod: card, Value: 600 }],
            })

            let payments = await findPayments(created.IdExpense)

            expect(payments.map((item) => item.Value)).toEqual([100, 100, 100, 100, 100, 100])

            expect(payments.map((item) => item.CompetenceDate)).toEqual([
                "2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10",
            ])

            //  E o caixa continua sendo a fatura de cada parcela, um mês à frente da competência
            expect(payments.map((item) => item.CashDate)).toEqual([
                "2026-08-28", "2026-09-28", "2026-10-28", "2026-11-28", "2026-12-28", "2027-01-28",
            ])
        })

        //  **Trocar o modo vale para o futuro.** A data é congelada na perna no lançamento, e é
        //  isso que impede virar a chave em novembro de reescrever agosto.
        it("não mexe na perna já gravada quando o modo do cartão muda", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, { CompetenceMode: "purchase" })

            let created = await createExpense(workspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: card, Value: 100 }] })

            expect((await findPayments(created.IdExpense))[0].CompetenceDate).toBe("2026-08-21")

            let update = await workspace.client.put(`/PaymentMethods/IdPaymentMethod=${card}`, { Name: "Cartão", CompetenceMode: "invoice" })

            expect(update.status).toBe(200)

            expect((await findPayments(created.IdExpense))[0].CompetenceDate).toBe("2026-08-21")

            //  A compra seguinte já nasce no modo novo: o que é congelado é a perna, não a regra
            let next = await createExpense(workspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: card, Value: 100 }] })

            expect((await findPayments(next.IdExpense))[0].CompetenceDate).toBe("2026-09-28")
        })

        //  **O saldo não pode mudar com o modo** — o parâmetro responde "quanto eu gastei",
        //  nunca "quanto eu tenho". É a armadilha que a etapa tinha que resolver antes de subir:
        //  com o saldo cortando pela competência, a compra de agosto quitada na fatura de
        //  setembro sairia do saldo de agosto e todo mês passado ficaria errado.
        it("dá o mesmo Balance nos dois modos, antes e depois de a fatura ser paga", async () => {
            let everydayWorkspace = await buildWorkspace()
            let deferredWorkspace = await buildWorkspace()

            let everyday = await createCard(everydayWorkspace, { CompetenceMode: "purchase" })
            let deferred = await createCard(deferredWorkspace, { CompetenceMode: "invoice" })

            await createExpense(everydayWorkspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: everyday, Value: 100 }] })
            await createExpense(deferredWorkspace, { ExpenseDate: "2026-08-21", Payments: [{ IdPaymentMethod: deferred, Value: 100 }] })

            //  Fatura em aberto: os 1000 da abertura continuam inteiros nos dois
            expect(await balanceOfMonth(everydayWorkspace, "2026-08")).toBe(1000)
            expect(await balanceOfMonth(deferredWorkspace, "2026-08")).toBe(1000)

            await everydayWorkspace.client.post(`/PaymentMethods/IdPaymentMethod=${everyday}/payInvoice`, { DueDate: "2026-09-28" })
            await deferredWorkspace.client.post(`/PaymentMethods/IdPaymentMethod=${deferred}/payInvoice`, { DueDate: "2026-09-28" })

            //  **Agosto continua com 1000 nos dois**: o dinheiro saiu em setembro, com a fatura,
            //  por mais que no cartão 'purchase' a compra pese em agosto
            expect(await balanceOfMonth(everydayWorkspace, "2026-08")).toBe(1000)
            expect(await balanceOfMonth(deferredWorkspace, "2026-08")).toBe(1000)

            expect(await balanceOfMonth(everydayWorkspace, "2026-09")).toBe(900)
            expect(await balanceOfMonth(deferredWorkspace, "2026-09")).toBe(900)
        })
    })

    describe("PUT /Expenses/IdExpense=:IdExpense", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Expenses/IdExpense=1`, buildUpdateBody(rootCategory))

            expect(response.status).toBe(401)
        })

        it("recusa gasto inexistente", async () => {
            let response = await client.put(`/Expenses/IdExpense=999999`, buildUpdateBody(rootCategory))

            expect(response.status).toBe(406)
        })

        it("recusa o gasto de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner, { Description: "Gasto do vizinho" })

            let response = await otherClient.put(`/Expenses/IdExpense=${created.IdExpense}`, buildUpdateBody(rootCategory))

            expect(response.status).toBe(406)
            expect((await findExpense(created.IdExpense)).Description).toBe("Gasto do vizinho")
        })

        //  Status é derivado: aceitar no corpo abriria a porta para o gasto dizer que está pago
        //  sem nenhuma perna quitada
        it("recusa Status ou Kind no corpo", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            expect((await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, {
                ...buildUpdateBody(workspace.IdCategory),
                Status: "paid",
            })).status).toBe(406)

            expect((await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, {
                ...buildUpdateBody(workspace.IdCategory),
                Kind: "fixed",
            })).status).toBe(406)
        })

        it("edita descrição, valor, data e categoria", async () => {
            let workspace = await buildWorkspace()
            let category = await createCategory(workspace, "Mercado")
            let created = await createExpense(workspace, { TotalValue: 100 })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, {
                Description: "Mercado do mês",
                TotalValue: 150,
                ExpenseDate: "2026-08-15",
                IdCategory: category,
                Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: 150 }],
            })

            expect(response.status).toBe(200)
            expect(await findExpense(created.IdExpense)).toMatchObject({
                Description: "Mercado do mês",
                TotalValue: 150,
                ExpenseDate: "2026-08-15",
                IdCategory: category,
            })
        })

        //  Quando só o total muda, é o eixo gravado que deixa de fechar
        it("recusa mudar o total deixando as pernas sem fechar", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 100 })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, buildUpdateBody(workspace.IdCategory, { TotalValue: 180 }))

            expect(response.status).toBe(406)
            expect((await findExpense(created.IdExpense)).TotalValue).toBe(100)
        })

        it("mantém os eixos gravados quando o corpo não os traz", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                TotalValue: 100,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 100 }],
            })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, buildUpdateBody(workspace.IdCategory, {
                Description: "Só o nome",
                TotalValue: 100,
            }))

            expect(response.status).toBe(200)
            expect(await findPayments(created.IdExpense)).toHaveLength(1)
            expect(await findPersons(created.IdExpense)).toHaveLength(1)
        })

        //  Reparcelar por baixo dos panos mudaria de mês faturas já lançadas
        it("recusa editar as pernas de uma compra parcelada", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, {
                ...buildUpdateBody(workspace.IdCategory, { TotalValue: 300 }),
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            expect(response.status).toBe(406)
            expect(await findPayments(created.IdExpense)).toHaveLength(3)
        })

        it("recusa editar gasto cancelado", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}`, buildUpdateBody(workspace.IdCategory))

            expect(response.status).toBe(406)
        })
    })

    describe("DELETE /Expenses/IdExpense=:IdExpense", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Expenses/IdExpense=1`)

            expect(response.status).toBe(401)
        })

        it("recusa gasto inexistente", async () => {
            let response = await client.delete(`/Expenses/IdExpense=999999`)

            expect(response.status).toBe(406)
        })

        it("recusa o gasto de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createExpense(owner)

            let response = await otherClient.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(response.status).toBe(406)
            expect((await findExpense(created.IdExpense)).Status).toBe("pending")
        })

        it("cancela sem apagar a linha nem as pernas", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            let response = await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(response.status).toBe(200)
            expect((await findExpense(created.IdExpense)).Status).toBe("canceled")
            expect(await findPayments(created.IdExpense)).toHaveLength(1)
        })

        //  O estorno: a perna continua com Paid=true, mas gasto cancelado não move saldo
        it("devolve o dinheiro ao cancelar um gasto já quitado", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace, { TotalValue: 250, Paid: true })

            expect(await accountBalance(workspace)).toBe(750)

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(await accountBalance(workspace)).toBe(1000)
            //  O fato histórico fica gravado
            expect((await findPayments(created.IdExpense))[0].Paid).toBe(true)
        })

        //  As 6 parcelas são pernas de uma linha só: não há como cancelar meia compra
        it("cancela a compra parcelada inteira", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            let created = await createExpense(workspace, {
                TotalValue: 300,
                Kind: "installment",
                InstallmentTotal: 3,
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect((await findExpense(created.IdExpense)).Status).toBe("canceled")
            expect(await findPayments(created.IdExpense)).toHaveLength(3)
        })

        it("recusa cancelar duas vezes", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            let response = await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}`)

            expect(response.status).toBe(406)
        })
    })

    describe("PUT /Expenses/IdExpense=:IdExpense/series", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().put(`/Expenses/IdExpense=1/series`, {
                Description: "X",
                TotalValue: 10,
                IdCategory: rootCategory,
            })

            expect(response.status).toBe(401)
        })

        it("recusa gasto que não é fixo", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}/series`, {
                Description: "X",
                TotalValue: 100,
                IdCategory: workspace.IdCategory,
            })

            expect(response.status).toBe(406)
        })

        //  **O teste que sustenta a etapa 7:** o aluguel que subiu em outubro não reescreve o
        //  que se pagou em agosto
        it("edita da ocorrência escolhida para a frente e não toca no passado", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Description: "Aluguel",
                TotalValue: 1500,
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-11-30",
            })

            let series = await findSeries(created.IdExpense)
            let third = series[2]

            let response = await workspace.client.put(`/Expenses/IdExpense=${third.IdExpense}/series`, {
                Description: "Aluguel reajustado",
                TotalValue: 1650,
                IdCategory: workspace.IdCategory,
            })

            expect(response.status).toBe(200)
            expect(response.body.Occurrences).toBe(2)

            let updated = await findSeries(created.IdExpense)

            //  As duas primeiras guardam o valor que realmente valeu
            expect(updated.slice(0, 2).map((item) => item.TotalValue)).toEqual([1500, 1500])
            expect(updated.slice(2).map((item) => item.TotalValue)).toEqual([1650, 1650])
            expect(updated[0].Description).toBe("Aluguel")
            expect(updated[2].Description).toBe("Aluguel reajustado")
        })

        //  A perna acompanha o total, senão o eixo financeiro deixaria de fechar
        it("acerta a perna de cada ocorrência editada", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                TotalValue: 100,
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-10-31",
            })

            await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}/series`, {
                Description: "Novo valor",
                TotalValue: 250,
                IdCategory: workspace.IdCategory,
            })

            for (let occurrence of await findSeries(created.IdExpense)) {
                expect((await findPayments(occurrence.IdExpense))[0].Value).toBe(250)
            }
        })

        it("recusa rateio que não fecha com o novo total", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                TotalValue: 100,
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-09-30",
            })

            let response = await workspace.client.put(`/Expenses/IdExpense=${created.IdExpense}/series`, {
                Description: "Com rateio torto",
                TotalValue: 200,
                IdCategory: workspace.IdCategory,
                Persons: [{ IdPerson: workspace.user.person.IdPerson, Value: 150 }],
            })

            expect(response.status).toBe(406)
        })
    })

    describe("DELETE /Expenses/IdExpense=:IdExpense/series", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().delete(`/Expenses/IdExpense=1/series`)

            expect(response.status).toBe(401)
        })

        it("recusa gasto que não é fixo", async () => {
            let workspace = await buildWorkspace()
            let created = await createExpense(workspace)

            let response = await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}/series`)

            expect(response.status).toBe(406)
        })

        //  Cancelar a assinatura em outubro não apaga o que foi pago antes
        it("encerra da ocorrência escolhida para a frente e registra o fim na raiz", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Description: "Assinatura",
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-11-30",
            })

            let series = await findSeries(created.IdExpense)

            let response = await workspace.client.delete(`/Expenses/IdExpense=${series[2].IdExpense}/series`)

            expect(response.status).toBe(200)
            expect(response.body.Canceled).toBe(2)

            let updated = await findSeries(created.IdExpense)

            expect(updated.map((item) => item.Status)).toEqual(["pending", "pending", "canceled", "canceled"])
            //  A raiz passa a dizer até quando a série existiu
            expect(updated[0].RecurrenceEndDate).toBe("2026-09-05")
        })

        it("encerra a série inteira quando chamada na raiz", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-10-31",
            })

            let response = await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}/series`)

            expect(response.status).toBe(200)
            expect((await findSeries(created.IdExpense)).every((item) => item.Status === "canceled")).toBe(true)
        })

        it("recusa encerrar duas vezes a partir da mesma ocorrência", async () => {
            let workspace = await buildWorkspace()

            let created = await createExpense(workspace, {
                Kind: "fixed",
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-09-30",
            })

            await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}/series`)

            let response = await workspace.client.delete(`/Expenses/IdExpense=${created.IdExpense}/series`)

            expect(response.status).toBe(406)
        })
    })

    describe("Fluxo end to end", () => {

        //  Passos 6, 7, 8 e 9 do "como saber que a leva acabou": gasto no débito quitado,
        //  compra em 6x no cartão, gasto fixo, e os números fechando no fim
        it("percorre o mês inteiro só por HTTP e os saldos fecham", async () => {
            let payload = {
                Name: "Usuário do fluxo de gastos",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            //  Conta com pix e débito, mais um cartão
            let account = await flowClient.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })
            let methods = (await flowClient.get(`/Accounts`)).body[0].PaymentMethods
            let debit = methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod

            let card = await flowClient.post(`/PaymentMethods`, {
                IdAccount: account.body.IdAccount,
                Name: "Cartão",
                Kind: "credit_card",
                DueDay: 28,
                ClosingOffsetDays: 8,
            })

            let category = await flowClient.post(`/Categories`, { Description: "Casa" })
            let persons = await flowClient.get(`/Persons`)

            //  6. gasto simples no débito, quitado na hora
            let market = await flowClient.post(`/Expenses`, {
                Description: "Mercado",
                TotalValue: 400,
                ExpenseDate: "2026-08-10",
                IdCategory: category.body.IdCategory,
                Payments: [{ IdPaymentMethod: debit, Value: 400, Paid: true }],
                Persons: [{ IdPerson: persons.body[0].IdPerson, Value: 400 }],
            })

            expect(market.status).toBe(200)
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(4600)

            //  7. compra parcelada em 6x no cartão
            let notebook = await flowClient.post(`/Expenses`, {
                Description: "Notebook",
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                IdCategory: category.body.IdCategory,
                ExpenseDate: "2026-08-10",
                Payments: [{ IdPaymentMethod: card.body.IdPaymentMethod, Value: 600 }],
            })

            expect(notebook.status).toBe(200)

            let detail = await flowClient.get(`/Expenses/IdExpense=${notebook.body.IdExpense}`)

            expect(detail.body.Payments).toHaveLength(6)
            expect(detail.body.Payments[0]).toMatchObject({ Value: 100, InstallmentNumber: 1, DueDate: "2026-08-28" })
            //  Nada quitado ainda: a compra no cartão não tirou dinheiro da conta
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(4600)

            //  Paga a **fatura** de agosto: só a parcela dela sai do saldo, e o gasto continua
            //  pendente. No cartão a perna sozinha não quita — quem quita é a fatura.
            let invoice = await flowClient.post(`/PaymentMethods/IdPaymentMethod=${card.body.IdPaymentMethod}/payInvoice`, { DueDate: "2026-08-28" })

            expect(invoice.status).toBe(200)
            expect(invoice.body.Payments).toBe(1)
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(4500)
            expect((await flowClient.get(`/Expenses/IdExpense=${notebook.body.IdExpense}`)).body.Status).toBe("pending")

            //  8. gasto fixo: a raiz e as ocorrências
            let rent = await flowClient.post(`/Expenses`, {
                Description: "Aluguel",
                TotalValue: 1500,
                Kind: "fixed",
                IdCategory: category.body.IdCategory,
                ExpenseDate: "2026-08-05",
                RecurrenceEndDate: "2026-10-31",
                Payments: [{ IdPaymentMethod: debit, Value: 1500 }],
            })

            expect(rent.status).toBe(200)
            expect(rent.body.Occurrences).toBe(3)

            //  9. a leitura do mês, e os números fechando
            let month = await flowClient.get(`/Expenses?From=2026-08-01&To=2026-08-31`)

            //  Mercado, notebook e a primeira ocorrência do aluguel
            expect(month.body).toHaveLength(3)

            let salary = await flowClient.post(`/Inflows`, {
                Description: "Salário",
                TotalValue: 3000,
                IdToAccount: account.body.IdAccount,
                CompetenceDate: "2026-08-05",
            })

            expect((await flowClient.post(`/Inflows/IdInflow=${salary.body.IdInflow}/receive`)).status).toBe(200)

            //  5000 de abertura − 400 de mercado − 100 da parcela + 3000 de salário
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(7500)

            //  Quita o aluguel deste mês e o saldo acompanha
            let rentDetail = await flowClient.get(`/Expenses/IdExpense=${rent.body.IdExpense}`)

            expect((await flowClient.post(`/ExpensePayments/IdExpensePayment=${rentDetail.body.Payments[0].IdExpensePayment}/pay`)).status).toBe(200)
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(6000)
            expect((await flowClient.get(`/Expenses/IdExpense=${rent.body.IdExpense}`)).body.Status).toBe("paid")

            //  E o aluguel sobe a partir da ocorrência de setembro, sem reescrever agosto
            let series = await flowClient.get(`/Expenses?Kind=fixed`)

            expect(series.body).toHaveLength(3)

            expect((await flowClient.put(`/Expenses/IdExpense=${series.body[1].IdExpense}/series`, {
                Description: "Aluguel reajustado",
                TotalValue: 1650,
                IdCategory: category.body.IdCategory,
            })).status).toBe(200)

            let after = await flowClient.get(`/Expenses?Kind=fixed`)

            expect(after.body.map((item: { TotalValue: number }) => item.TotalValue)).toEqual([1500, 1650, 1650])
            //  O que já foi pago em agosto continua valendo 1500, e o saldo não mudou
            expect(await balanceOf(flowClient, account.body.IdAccount)).toBe(6000)
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
//  tudo que existe na conta — reaproveitar workspace faria um teste enxergar o gasto do outro.
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

async function createCard(workspace: TestWorkspace, overrides: { DueDay?: number, ClosingOffsetDays?: number, CompetenceMode?: "invoice" | "purchase" } = {}) {
    let response = await workspace.client.post(`/PaymentMethods`, {
        IdAccount: workspace.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: overrides.DueDay ?? 28,
        ClosingOffsetDays: overrides.ClosingOffsetDays ?? 8,
        //  Sem override vale o padrão do cadastro, 'purchase'. As datas de fatura
        //  (ClosingDate/DueDate) não dependem do modo, então os testes que olham para elas
        //  seguem valendo em qualquer um — quem muda é só a CompetenceDate.
        ...(overrides.CompetenceMode ? { CompetenceMode: overrides.CompetenceMode } : {}),
    })

    return response.body.IdPaymentMethod as number
}

function createCategory(workspace: TestWorkspace, Description: string) {
    return workspace.client.post(`/Categories`, { Description }).then((response) => response.body.IdCategory as number)
}

function createPerson(workspace: TestWorkspace, Name: string) {
    return workspace.client.post(`/Persons`, { Name }).then((response) => response.body.IdPerson as number)
}

//  O corpo mínimo de um gasto: uma perna no débito fechando com o total. O `Paid` é atalho de
//  arranjo — na rota ele mora dentro da perna.
function buildBody(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let { Paid, ...rest } = overrides

    return {
        Description: "Gasto de teste",
        TotalValue: 100,
        IdCategory: workspace.IdCategory,
        ExpenseDate: "2026-08-10",
        Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: overrides.TotalValue ?? 100, Paid: Boolean(Paid) }],
        ...rest,
    }
}

//  A categoria é obrigatória no PUT também, então quem chama passa a do seu workspace
function buildUpdateBody(IdCategory: number, overrides: Record<string, unknown> = {}) {
    return {
        Description: "Gasto editado",
        TotalValue: 100,
        IdCategory,
        ExpenseDate: "2026-08-10",
        ...overrides,
    }
}

async function createExpense(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let response = await workspace.client.post(`/Expenses`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number, Occurrences: number }
}

//#endregion

//#region Leitura

function description(item: { Description: string }) {
    return item.Description
}

async function accountBalance(workspace: TestWorkspace) {
    return await balanceOf(workspace.client, workspace.IdAccount)
}

//  O saldo de um mês fechado — o mesmo cálculo, com o corte que a rota já aceita
async function balanceOfMonth(workspace: TestWorkspace, ReferenceMonth: string) {
    let response = await workspace.client.get(`/Accounts?ReferenceMonth=${ReferenceMonth}`)

    return response.body.find((item: { IdAccount: number }) => item.IdAccount === workspace.IdAccount).Balance as number
}

//  O saldo sai pela rota de contas: ele não é coluna, é calculado a cada leitura
async function balanceOf(client: TestClient, IdAccount: number) {
    let response = await client.get(`/Accounts`)

    return response.body.find((item: { IdAccount: number }) => item.IdAccount === IdAccount).Balance as number
}

function findExpense(IdExpense: number) {
    return TestDatabase.connection().select("*").from("Expenses").where("IdExpense", IdExpense).first()
}

//  A raiz e as ocorrências, em ordem de data: é assim que a série se lê
function findSeries(IdRootExpense: number) {
    return TestDatabase.connection()
        .select("*")
        .from("Expenses")
        .where((query) => query.where("IdExpense", IdRootExpense).orWhere("IdParentExpense", IdRootExpense))
        .orderBy("ExpenseDate")
}

function findPayments(IdExpense: number) {
    return TestDatabase.connection().select("*").from("ExpensePayments").where("IdExpense", IdExpense).orderBy("IdExpensePayment")
}

function findPersons(IdExpense: number) {
    return TestDatabase.connection().select("*").from("ExpensePersons").where("IdExpense", IdExpense).orderBy("IdExpensePerson")
}

//#endregion
