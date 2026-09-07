import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"
import { Utils } from "root/Utils/Utils"

//  Testes integrados de Reports — a feature que não tem tabela própria: ela lê de todas as
//  outras. Um describe por rota de Reports.route.ts, mais o fluxo end to end no fim.
//
//  O que a suíte precisa provar não é que as somas somam: é que **as regras que se contradizem
//  de propósito continuam contradizendo**, porque foi a réplica delas no cliente que motivou a
//  feature inteira.
//
//      quanto entrou      ->  transferência FORA
//      quanto gastou      ->  perna, nunca o TotalValue da compra
//      saldo da conta     ->  pendente FORA
//      posso gastar       ->  pendente DENTRO, e abrindo com o saldo do mês anterior
//
//  E uma asserção acima de todas: **o CurrentBalance daqui é o mesmo número que o Balance de
//  GET /Accounts** — é ela que percebe o dia em que as duas telas começarem a discordar.

describe("Reports", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Accounts, Inflows e Expenses junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos relatórios" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
    })

    describe("GET /Reports/Month", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Reports/Month`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Reports/Month`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            expect((await forged.get(`/Reports/Month`)).status).toBe(406)
        })

        //  Mês, e não From/To: as duas pontas do cálculo são posições, não recortes
        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09-01`)).status).toBe(406)
        })

        it("assume o mês corrente quando o parâmetro não vem", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Reports/Month`)

            expect(response.status).toBe(200)
            expect(response.body.ReferenceMonth).toMatch(/^\d{4}-\d{2}-01$/)
        })

        //  Mês sem lançamento nenhum: sobra a abertura da conta, que é dado de origem
        it("devolve a abertura da conta no mês sem lançamento", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                ReferenceMonth: "2026-09-01",
                OpeningBalance: 1000,
                Inflows: 0,
                Expenses: 0,
                OverdueReceivable: 0,
                OverduePayable: 0,
                Available: 1000,
                CurrentBalance: 1000,
                OpenInvoices: 0,
            })
        })

        //  **O erro que a etapa nasceu para consertar.** O cliente somava as entradas do mês
        //  para dizer quanto ainda dava para gastar, e essa conta ignora o dinheiro que já
        //  estava na conta no dia 1º: quem começa setembro com 1000 e recebe 3000 via 3000,
        //  tendo 4000. Não é problema de escala — dá errado com dois lançamentos no banco.
        it("abre o mês com o saldo realizado do mês anterior", async () => {
            let workspace = await buildWorkspace()

            //  Recebida em agosto: em setembro ela já é saldo, não entrada
            await receive(workspace, await createInflow(workspace, { TotalValue: 500, CompetenceDate: "2026-08-05" }))

            await createInflow(workspace, { TotalValue: 3000, CompetenceDate: "2026-09-05" })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.OpeningBalance).toBe(1500)
            expect(response.body.Inflows).toBe(3000)
            //  1500 que já estavam + 3000 do mês: **4500, não 3000**
            expect(response.body.Available).toBe(4500)
        })

        //  A linha "Entradas" da tabela de decisões: o indicador é de planejamento, e contar
        //  entrada só quando recebida com gasto já quando lançado o deixaria pessimista dos
        //  dois lados. O saldo, que é realizado, ignora as duas.
        it("conta a entrada pendente no Available e não no CurrentBalance", async () => {
            let workspace = await buildWorkspace()

            await createInflow(workspace, { TotalValue: 3000, CompetenceDate: "2026-09-05" })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.Available).toBe(4000)
            expect(response.body.CurrentBalance).toBe(1000)
        })

        it("desce o Available com a perna pendente, sem mexer no CurrentBalance", async () => {
            let workspace = await buildWorkspace()

            await createExpense(workspace, { TotalValue: 250, ExpenseDate: "2026-09-10" })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.Expenses).toBe(250)
            expect(response.body.Available).toBe(750)
            expect(response.body.CurrentBalance).toBe(1000)
        })

        //  **A unidade é a perna, nunca o TotalValue da compra** — é ela que faz o indicador
        //  funcionar com parcelamento, e é por ela que esta etapa depende da leva 2
        it("conta 100 da compra de 600 em 6x, não 600", async () => {
            let workspace = await buildWorkspace()

            await createExpense(workspace, {
                TotalValue: 600,
                ExpenseDate: "2026-09-10",
                Kind: "installment",
                InstallmentTotal: 6,
            })

            expect((await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)).body.Expenses).toBe(100)
            expect((await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-10`)).body.Expenses).toBe(100)
        })

        //  **Transferência é soma zero para o patrimônio**, e é a regra oposta à do saldo, que
        //  conta as duas pontas. Sem este filtro o mesmo dinheiro entraria de novo a cada vez
        //  que mudasse de conta — e o número ficaria plausível.
        it("não conta a transferência como entrada, e o patrimônio não muda", async () => {
            let workspace = await buildWorkspace()

            let second = await workspace.client.post(`/Accounts`, { Name: "Poupança", InitialBalance: 0 })

            await receive(workspace, await createInflow(workspace, {
                Description: "Para a poupança",
                TotalValue: 400,
                Kind: "transfer",
                IdFromAccount: workspace.IdAccount,
                IdToAccount: second.body.IdAccount,
                CompetenceDate: "2026-09-10",
            }))

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.Inflows).toBe(0)
            expect(response.body.CurrentBalance).toBe(1000)
            expect(response.body.Available).toBe(1000)
        })

        //  **O atrasado entra dos dois lados, e vai exposto à parte.** Uma perna com competência
        //  em julho e ainda pendente não está no saldo de julho nem na janela de agosto: ela
        //  sumiria do indicador — e sumiria justamente o compromisso que ninguém honrou.
        it("soma o recebível vencido e subtrai a dívida vencida", async () => {
            let workspace = await buildWorkspace()

            await createInflow(workspace, { TotalValue: 800, CompetenceDate: "2026-07-05" })
            await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-07-10" })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.OverdueReceivable).toBe(800)
            expect(response.body.OverduePayable).toBe(300)
            //  Nada disso está no mês de setembro, e nada disso está no saldo
            expect(response.body.Inflows).toBe(0)
            expect(response.body.Expenses).toBe(0)
            expect(response.body.Available).toBe(1500)
            expect(response.body.CurrentBalance).toBe(1000)
        })

        it("tira do vencido o que já foi recebido ou pago", async () => {
            let workspace = await buildWorkspace()

            await receive(workspace, await createInflow(workspace, { TotalValue: 800, CompetenceDate: "2026-07-05" }))

            let expense = await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-07-10" })

            await pay(workspace, expense.IdExpense)

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.OverdueReceivable).toBe(0)
            expect(response.body.OverduePayable).toBe(0)
            //  Os dois viraram saldo: 1000 + 800 − 300
            expect(response.body.OpeningBalance).toBe(1500)
            expect(response.body.Available).toBe(1500)
        })

        it("ignora gasto e entrada cancelados", async () => {
            let workspace = await buildWorkspace()

            let inflow = await createInflow(workspace, { TotalValue: 900, CompetenceDate: "2026-09-05" })
            let expense = await createExpense(workspace, { TotalValue: 400, ExpenseDate: "2026-09-10" })

            await workspace.client.delete(`/Inflows/IdInflow=${inflow}`)
            await workspace.client.delete(`/Expenses/IdExpense=${expense.IdExpense}`)

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.Inflows).toBe(0)
            expect(response.body.Expenses).toBe(0)
            expect(response.body.Available).toBe(1000)
        })

        //  **O número que liga os dois indicadores.** O buraco que o "posso gastar" mostra hoje
        //  é o que o "tenho em conta" vai mostrar quando a fatura for paga.
        it("expõe em OpenInvoices a fatura que vence no mês e ainda não foi paga", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            await createExpense(workspace, {
                TotalValue: 500,
                ExpenseDate: "2026-09-10",
                Payments: [{ IdPaymentMethod: card, Value: 500 }],
            })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body.OpenInvoices).toBe(500)
            expect(response.body.CurrentBalance).toBe(1000)

            //  Pagar a fatura **não cria lançamento**: só vira o Paid de pernas que já existem.
            //  O gasto contado em setembro não volta a contar em lugar nenhum.
            await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: "2026-09-28" })

            let after = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(after.body.OpenInvoices).toBe(0)
            expect(after.body.CurrentBalance).toBe(500)
            expect(after.body.Expenses).toBe(500)
        })

        //  **A asserção que impede as duas telas de divergirem.** O CurrentBalance é a soma dos
        //  Balance que GET /Accounts devolve para o mesmo mês, e não uma segunda implementação
        //  da mesma pergunta — que é como duas telas passam a mostrar totais diferentes.
        it("devolve em CurrentBalance a mesma soma dos Balance de GET /Accounts", async () => {
            let workspace = await buildWorkspace()

            await workspace.client.post(`/Accounts`, { Name: "Poupança", InitialBalance: 250 })

            await receive(workspace, await createInflow(workspace, { TotalValue: 700, CompetenceDate: "2026-09-05" }))

            let expense = await createExpense(workspace, { TotalValue: 120, ExpenseDate: "2026-09-10" })
            await pay(workspace, expense.IdExpense)

            let accounts = await workspace.client.get(`/Accounts?ReferenceMonth=2026-09`)
            let report = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            let sum = accounts.body.reduce((total: number, item: { Balance: number }) => total + item.Balance, 0)

            expect(report.body.CurrentBalance).toBe(sum)
            expect(report.body.CurrentBalance).toBe(1830)
        })

        //  O mesmo filtro do GET /Accounts, senão a soma do Dashboard discorda da lista de
        //  contas na mesma tela
        it("deixa a conta arquivada fora do saldo", async () => {
            let workspace = await buildWorkspace()

            let second = await workspace.client.post(`/Accounts`, { Name: "Conta antiga", InitialBalance: 400 })

            expect((await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)).body.CurrentBalance).toBe(1400)

            await workspace.client.delete(`/Accounts/IdAccount=${second.body.IdAccount}`)

            expect((await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)).body.CurrentBalance).toBe(1000)
        })

        it("não enxerga o lançamento de outro workspace", async () => {
            let mine = await buildWorkspace()
            let theirs = await buildWorkspace()

            await createInflow(theirs, { TotalValue: 5000, CompetenceDate: "2026-09-05" })

            expect((await mine.client.get(`/Reports/Month?ReferenceMonth=2026-09`)).body.Inflows).toBe(0)
        })
    })

    //  **O extrato é a abertura do saldo, não uma consulta paralela.** Toda a suíte gira em
    //  torno de uma asserção: OpeningBalance + soma das linhas === ClosingBalance, e o
    //  ClosingBalance é o mesmo Balance que GET /Accounts devolve para o mês.
    //
    //  E de uma assimetria que é de propósito, e é a coisa mais fácil de conflatar aqui:
    //
    //      extrato da conta  ->  caixa: o dinheiro que passou. SÓ liquidado
    //      extrato do cartão ->  a fatura: o que foi comprado.  pago E pendente
    describe("GET /Reports/Statement", () => {

        it("recusa sem token", async () => {
            expect((await client.anonymous().get(`/Reports/Statement`)).status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Reports/Statement`)

            expect(response.status).toBe(406)
        })

        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09-01`)).status).toBe(406)
        })

        it("devolve a conta sem linha nenhuma no mês vazio", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)

            expect(response.status).toBe(200)
            expect(response.body.Accounts).toHaveLength(1)
            expect(response.body.Accounts[0]).toMatchObject({
                IdAccount: workspace.IdAccount,
                Name: "Conta corrente",
                OpeningBalance: 1000,
                ClosingBalance: 1000,
                Entries: [],
            })
            expect(response.body.Cards).toEqual([])
        })

        //  **O teste da etapa:** ele é a demanda escrita como asserção, e é o único que percebe
        //  o extrato começando a divergir do saldo.
        it("fecha em centavos, e o ClosingBalance é o Balance de GET /Accounts", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            await receive(workspace, await createInflow(workspace, { TotalValue: 3000, CompetenceDate: "2026-09-05" }))

            let power = await createExpense(workspace, { TotalValue: 199.99, ExpenseDate: "2026-09-08" })
            await pay(workspace, power.IdExpense)

            await createExpense(workspace, {
                TotalValue: 320.55,
                ExpenseDate: "2026-09-10",
                Payments: [{ IdPaymentMethod: card, Value: 320.55 }],
            })

            await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: "2026-09-28" })

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body
            let [account] = statement.Accounts

            expectClosing(account)

            let balance = (await workspace.client.get(`/Accounts?ReferenceMonth=2026-09`)).body
                .find((item: { IdAccount: number }) => item.IdAccount === workspace.IdAccount).Balance

            expect(account.ClosingBalance).toBe(balance)
        })

        //  A abertura da conta é a única linha do extrato que não é lançamento nenhum — e sem
        //  ela a soma não fecharia no mês em que a conta nasceu
        it("lança o saldo inicial como linha no mês da abertura", async () => {
            let user = await UsersFactory.create()
            let client = new TestClient(user.token)

            let account = await client.post(`/Accounts`, { Name: "Conta nova", InitialBalance: 700, InitialBalanceDate: "2026-09-10" })

            let statement = (await client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body
            let row = statement.Accounts.find((item: { IdAccount: number }) => item.IdAccount === account.body.IdAccount)

            expect(row.OpeningBalance).toBe(0)
            expect(row.ClosingBalance).toBe(700)
            expect(row.Entries).toEqual([{ Date: "2026-09-10", Kind: "opening", Description: "Saldo inicial", Value: 700 }])

            expectClosing(row)
        })

        //  **Aqui NÃO se filtra Kind='transfer'** — o filtro que "quanto entrou no mês" exige é
        //  justamente o que não vale no extrato: a transferência é saída real de uma conta e
        //  entrada real na outra
        it("mostra a transferência nas duas contas, com sinais opostos", async () => {
            let workspace = await buildWorkspace()

            let second = await workspace.client.post(`/Accounts`, { Name: "Poupança", InitialBalance: 0 })

            await receive(workspace, await createInflow(workspace, {
                Description: "Para a poupança",
                TotalValue: 400,
                Kind: "transfer",
                IdFromAccount: workspace.IdAccount,
                IdToAccount: second.body.IdAccount,
                CompetenceDate: "2026-09-10",
            }))

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body

            let origin = statement.Accounts.find((item: { IdAccount: number }) => item.IdAccount === workspace.IdAccount)
            let destiny = statement.Accounts.find((item: { IdAccount: number }) => item.IdAccount === second.body.IdAccount)

            expect(origin.Entries).toHaveLength(1)
            expect(origin.Entries[0]).toMatchObject({ Kind: "transfer", Value: -400, Description: "Para a poupança" })
            expect(destiny.Entries[0]).toMatchObject({ Kind: "transfer", Value: 400 })

            //  A soma das duas não muda o patrimônio
            expect(origin.ClosingBalance + destiny.ClosingBalance).toBe(1000)

            expectClosing(origin)
            expectClosing(destiny)
        })

        //  Uma linha pendente no meio do extrato quebraria a soma, e um extrato que não fecha é
        //  pior do que extrato nenhum. Na fatura ela aparece, porque uma fatura existe antes de
        //  ser paga — é isso que a torna útil de olhar.
        it("esconde o gasto pendente da conta e o mostra no cartão", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            await createExpense(workspace, { TotalValue: 150, ExpenseDate: "2026-09-08" })

            await createExpense(workspace, {
                Description: "Mercado",
                TotalValue: 320,
                ExpenseDate: "2026-09-10",
                Payments: [{ IdPaymentMethod: card, Value: 320 }],
            })

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body

            expect(statement.Accounts[0].Entries).toEqual([])
            expectClosing(statement.Accounts[0])

            expect(statement.Cards).toHaveLength(1)
            expect(statement.Cards[0]).toMatchObject({ Name: "Cartão", DueDate: "2026-09-28", Total: 320 })
            expect(statement.Cards[0].Entries[0]).toMatchObject({ Date: "2026-09-10", Description: "Mercado", Value: 320, Paid: false })
        })

        //  Listadas cruas, quarenta compras do cartão viram quarenta linhas no extrato da conta
        //  — o que nenhum extrato bancário faz, e o que soterra as linhas que importam
        it("agrupa as compras do cartão numa linha só de fatura na conta", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            for (let index = 0; index < 40; index++) {
                await createExpense(workspace, {
                    Description: `Compra ${index}`,
                    TotalValue: 10,
                    ExpenseDate: "2026-09-10",
                    Payments: [{ IdPaymentMethod: card, Value: 10 }],
                })
            }

            await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: "2026-09-28" })

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body
            let [account] = statement.Accounts

            expect(account.Entries).toHaveLength(1)
            expect(account.Entries[0]).toMatchObject({
                Date: "2026-09-28",
                Kind: "invoice",
                Description: "Fatura Cartão",
                Value: -400,
                IdPaymentMethod: card,
            })

            //  O detalhe fica no extrato do cartão, que a tela mostra ao lado — e o total do
            //  grupo é o mesmo que as pernas somavam
            expect(statement.Cards[0].Entries).toHaveLength(40)
            expect(statement.Cards[0].Total).toBe(400)

            expectClosing(account)
        })

        it("não mostra o gasto cancelado em lugar nenhum, e o mês continua fechando", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            let onCard = await createExpense(workspace, {
                TotalValue: 500,
                ExpenseDate: "2026-09-10",
                Payments: [{ IdPaymentMethod: card, Value: 500 }],
            })

            let onDebit = await createExpense(workspace, { TotalValue: 90, ExpenseDate: "2026-09-12" })
            await pay(workspace, onDebit.IdExpense)

            await workspace.client.post(`/PaymentMethods/IdPaymentMethod=${card}/payInvoice`, { DueDate: "2026-09-28" })

            //  Cancelar um gasto quitado é o estorno dele: o dinheiro volta para a conta
            await workspace.client.delete(`/Expenses/IdExpense=${onCard.IdExpense}`)

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body
            let [account] = statement.Accounts

            expect(account.Entries).toHaveLength(1)
            expect(account.Entries[0]).toMatchObject({ Kind: "expense", Value: -90 })
            expect(statement.Cards).toEqual([])

            expectClosing(account)
        })

        //  Active = false quer dizer "não use mais", não "não existiu": o mês em que a conta
        //  ainda tinha movimento tem que ser consultável
        it("continua devolvendo o extrato da conta arquivada no mês em que teve movimento", async () => {
            let workspace = await buildWorkspace()

            let second = await workspace.client.post(`/Accounts`, { Name: "Conta antiga", InitialBalance: 0 })

            await receive(workspace, await createInflow(workspace, {
                TotalValue: 250,
                IdToAccount: second.body.IdAccount,
                CompetenceDate: "2026-09-05",
            }))

            await workspace.client.delete(`/Accounts/IdAccount=${second.body.IdAccount}`)

            let statement = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body
            let archived = statement.Accounts.find((item: { IdAccount: number }) => item.IdAccount === second.body.IdAccount)

            expect(archived).toMatchObject({ Active: false, ClosingBalance: 250 })
            expect(archived.Entries).toHaveLength(1)
            expectClosing(archived)

            //  E ela some do mês em que não teve movimento: arquivada e vazia não é linha de tela
            let empty = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-10`)).body

            expect(empty.Accounts.find((item: { IdAccount: number }) => item.IdAccount === second.body.IdAccount)).toBeUndefined()
        })

        //  Num cartão 'purchase' a competência é o mês da compra e a fatura é outra: agrupar
        //  pela competência partiria a fatura em pedaços que o emissor nunca cobrou
        it("monta a fatura do cartão 'purchase' pelo vencimento, não pela competência", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "purchase")

            //  Compra de 21/08: pesa em agosto, mas a fatura vence em 28/09
            await createExpense(workspace, {
                TotalValue: 200,
                ExpenseDate: "2026-08-21",
                Payments: [{ IdPaymentMethod: card, Value: 200 }],
            })

            expect((await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-08`)).body.Cards).toEqual([])

            let september = (await workspace.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body

            expect(september.Cards).toHaveLength(1)
            expect(september.Cards[0]).toMatchObject({ DueDate: "2026-09-28", Total: 200 })
            expect(september.Cards[0].Entries[0].Date).toBe("2026-08-21")
        })

        it("não enxerga a conta de outro workspace", async () => {
            let mine = await buildWorkspace()
            let theirs = await buildWorkspace()

            await receive(theirs, await createInflow(theirs, { TotalValue: 5000, CompetenceDate: "2026-09-05" }))

            let statement = (await mine.client.get(`/Reports/Statement?ReferenceMonth=2026-09`)).body

            expect(statement.Accounts).toHaveLength(1)
            expect(statement.Accounts[0].IdAccount).toBe(mine.IdAccount)
        })
    })

    describe("Fluxo end to end", () => {

        //  O mês inteiro montado por HTTP: abre com o saldo do mês anterior, recebe o salário,
        //  lança a compra no cartão e a conta de luz, e os dois indicadores contam a mesma
        //  história por caminhos diferentes.
        it("monta o mês do Dashboard, e os dois indicadores discordam pelo motivo certo", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace, "invoice")

            //  Agosto: 500 recebidos viram saldo de abertura de setembro
            await receive(workspace, await createInflow(workspace, { TotalValue: 500, CompetenceDate: "2026-08-05" }))

            //  Setembro: salário previsto, ainda não recebido
            await createInflow(workspace, { TotalValue: 3000, CompetenceDate: "2026-09-05" })

            //  Conta de luz no débito, paga
            let power = await createExpense(workspace, { TotalValue: 200, ExpenseDate: "2026-09-08" })
            await pay(workspace, power.IdExpense)

            //  Compra no cartão: pesa em setembro (fatura de 28/09) e ainda não saiu da conta
            await createExpense(workspace, {
                TotalValue: 300,
                ExpenseDate: "2026-09-10",
                Payments: [{ IdPaymentMethod: card, Value: 300 }],
            })

            let response = await workspace.client.get(`/Reports/Month?ReferenceMonth=2026-09`)

            expect(response.body).toEqual({
                ReferenceMonth: "2026-09-01",
                OpeningBalance: 1500,
                Inflows: 3000,
                Expenses: 500,
                OverdueReceivable: 0,
                OverduePayable: 0,
                //  1500 + 3000 − 500
                Available: 4000,
                //  1500 − 200: o salário não chegou e a fatura não foi paga
                CurrentBalance: 1300,
                //  E 300 do que sobrou já têm dono
                OpenInvoices: 300,
            })
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    IdAccount: number
    IdDebit: number
    IdCategory: number
}

//  Cada teste arruma o seu workspace, porque tudo aqui é soma de tudo que existe no tenant —
//  reaproveitar faria um teste enxergar o lançamento do outro.
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

//  O modo é explícito porque a competência do cartão depende dele: 'invoice' é o cartão que
//  pesa no mês da fatura, que é o que estes testes montam
async function createCard(workspace: TestWorkspace, CompetenceMode: "invoice" | "purchase") {
    let response = await workspace.client.post(`/PaymentMethods`, {
        IdAccount: workspace.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: 28,
        ClosingOffsetDays: 8,
        CompetenceMode,
    })

    return response.body.IdPaymentMethod as number
}

async function createInflow(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/Inflows`, {
        Description: "Entrada de teste",
        TotalValue: 100,
        IdToAccount: workspace.IdAccount,
        CompetenceDate: "2026-09-05",
        ...overrides,
    })

    expect(response.status).toBe(200)

    return response.body.IdInflow as number
}

function receive(workspace: TestWorkspace, IdInflow: number) {
    return workspace.client.post(`/Inflows/IdInflow=${IdInflow}/receive`)
}

async function createExpense(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let response = await workspace.client.post(`/Expenses`, {
        Description: "Gasto de teste",
        TotalValue: 100,
        IdCategory: workspace.IdCategory,
        ExpenseDate: "2026-09-10",
        Payments: [{ IdPaymentMethod: workspace.IdDebit, Value: overrides.TotalValue ?? 100 }],
        ...overrides,
    })

    expect(response.status).toBe(200)

    return response.body as { IdExpense: number }
}

//  **A asserção que carrega o extrato**, em centavos: soma das linhas + abertura = fechamento.
//  Em ponto flutuante 1000 − 199.99 − 320.55 não bate com o saldo por causa do último bit —
//  Utils.toCents é o que todo invariante de dinheiro do projeto usa.
function expectClosing(account: { OpeningBalance: number, ClosingBalance: number, Entries: Array<{ Value: number }> }) {
    let sum = account.Entries.reduce((total, entry) => total + Utils.toCents(entry.Value), Utils.toCents(account.OpeningBalance))

    expect(sum).toBe(Utils.toCents(account.ClosingBalance))
}

//  Quita todas as pernas do gasto. Fora do cartão, quitar é perna a perna — no cartão quem
//  quita é a fatura, e os testes que precisam disso chamam o payInvoice.
async function pay(workspace: TestWorkspace, IdExpense: number) {
    let payments = await TestDatabase.connection().select("IdExpensePayment").from("ExpensePayments").where("IdExpense", IdExpense)

    for (let payment of payments) {
        await workspace.client.post(`/ExpensePayments/IdExpensePayment=${payment.IdExpensePayment}/pay`)
    }
}

//#endregion
