import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de Budgets — a entrega reduzida do orçamento, em que o cadastro do mês é
//  manual. Um describe por rota de Budgets.route.ts, mais o fluxo end to end no fim.
//
//  As rotas do mês congelado são de outra feature e vivem em BudgetPeriods.test.ts; aqui o
//  período aparece como **efeito** do cadastro, que é o que este POST faz em duas tabelas.
//
//  Duas coisas carregam a suíte:
//
//  1. **duas tabelas, dois efeitos** — a definição é única por categoria e acompanha o teto
//     novo; o mês é congelado e não se mexe sozinho. É o que faz "em agosto meu teto era 800"
//     continuar tendo resposta depois do reajuste de setembro;
//  2. **o comprometido** — a parcela conta no mês em que vence, não no mês da compra, e o
//     pendente conta junto com o pago, ao contrário do saldo;
//  3. **o alvo é uma categoria OU uma pessoa** — a mesma tabela, o mesmo POST e a mesma lista,
//     com o `Spent` da pessoa **rateado pelas parcelas** para dar o mesmo número que a
//     categoria enxerga. Um gasto conta nos dois, e isso não é dupla contagem.

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

    describe("GET /Budgets", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        //  O mês é a unidade aqui, ao contrário das listagens de movimento
        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08-01`)).status).toBe(406)
            expect((await workspace.client.get(`/Budgets`)).status).toBe(406)
        })

        it("devolve lista vazia quando o mês não tem orçamento", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual([])
        })

        it("devolve o teto do mês com a categoria e o comprometido zerado", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

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

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body.map(limit)).toEqual([800])
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body.map(limit)).toEqual([900])
        })

        it("não devolve o orçamento de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createBudget(owner)

            expect((await otherClient.get(`/Budgets?ReferenceMonth=2026-08`)).body).toEqual([])
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

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.body[0].Spent).toBe(420.5)
        })

        //  Orçamento é **comprometido**, não realizado: o gasto lançado e ainda não quitado já
        //  consumiu o teto. É o oposto do saldo da conta, que só soma perna paga.
        it("conta o gasto pendente junto com o pago", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 100, ExpenseDate: "2026-08-10", Paid: true })
            await createExpense(workspace, { TotalValue: 200, ExpenseDate: "2026-08-11" })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(300)
        })

        it("não conta gasto cancelado", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace, { LimitValue: 800 })

            let canceled = await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-08-10" })

            await workspace.client.delete(`/Expenses/IdExpense=${canceled.IdExpense}`)

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(0)
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

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(100)
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body[0].Spent).toBe(100)
        })

        //  **O teste que sustenta a decisão do rateio.** Sem ele, o mesmo gasto contaria 600
        //  no orçamento da pessoa e 100 no da categoria, e "quanto a Maria comprometeu em
        //  agosto" não teria resposta certa.
        it("rateia a parcela pelo rateio do gasto: 600 em 6x da Maria dão 100 no mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson, Value: 600 }],
            })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body).toHaveLength(1)
            //  100, não 600: o rateio é do gasto e a parcela é da perna
            expect(response.body[0].Spent).toBe(100)
        })

        //  São duas perguntas diferentes sobre o mesmo dinheiro, e as duas respondem o mesmo
        //  número quando o gasto é todo de uma pessoa só. Somar as duas é que seria errado.
        it("conta a mesma compra no orçamento da categoria e no da pessoa", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 250,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson, Value: 250 }],
            })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.body).toHaveLength(2)

            let byScope = new Map(response.body.map((item: { Scope: string }) => [item.Scope, item]))

            expect((byScope.get("category") as { Spent: number }).Spent).toBe(250)
            expect((byScope.get("person") as { Spent: number }).Spent).toBe(250)
        })

        //  Arredonda **uma vez, no fim**: 400/600 da parcela de 100 é 66,666..., e arredondar
        //  por parcela espalharia o erro. As duas partes ainda fecham com a parcela.
        it("arredonda o rateio uma vez, no fim", async () => {
            let workspace = await buildWorkspace()
            let maria = await createPerson(workspace, "Maria")
            let joao = await createPerson(workspace, "João")

            await createPersonBudget(workspace, maria, { ReferenceMonth: "2026-08", LimitValue: 500 })
            await createPersonBudget(workspace, joao, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson: maria, Value: 400 }, { IdPerson: joao, Value: 200 }],
            })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            let byPerson = new Map(response.body.map((item: { IdPerson: number }) => [item.IdPerson, item]))

            expect((byPerson.get(maria) as { Spent: number }).Spent).toBe(66.67)
            expect((byPerson.get(joao) as { Spent: number }).Spent).toBe(33.33)
        })

        //  **Parece bug e não é.** Persons é opcional no gasto, então a soma dos orçamentos de
        //  pessoa não fecha com o total gasto do mês — está escrito no contrato por isso.
        it("não conta no orçamento de pessoa o gasto sem rateio", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, { TotalValue: 250, ExpenseDate: "2026-08-10" })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            let byScope = new Map(response.body.map((item: { Scope: string }) => [item.Scope, item]))

            //  A categoria enxerga o gasto inteiro; a pessoa não enxerga nada
            expect((byScope.get("category") as { Spent: number }).Spent).toBe(250)
            expect((byScope.get("person") as { Spent: number }).Spent).toBe(0)
        })

        //  O Scope vem derivado para o cliente não ter que deduzir o tipo pelo id que veio nulo
        it("devolve os dois tipos na mesma lista, com o alvo inteiro e o Scope derivado", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            let response = await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(response.body).toHaveLength(2)

            let byScope = new Map(response.body.map((item: { Scope: string }) => [item.Scope, item]))

            expect(byScope.get("category")).toMatchObject({
                IdCategory: workspace.IdCategory,
                IdPerson: null,
                Person: null,
                Category: { Description: "Mercado" },
            })

            expect(byScope.get("person")).toMatchObject({
                IdPerson,
                IdCategory: null,
                Category: null,
                Person: { Name: "Maria" },
            })
        })

        //  Mesma regra da categoria arquivada: o teto perde o que mostrar e sai da tela, mas a
        //  linha continua no banco — arquivar não é apagar, e o mês é histórico
        it("esconde do mês o orçamento de pessoa arquivada", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            let budget = await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await workspace.client.delete(`/Persons/IdPerson=${IdPerson}`)

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body).toHaveLength(0)
            expect(await findPeriods(budget.IdBudget)).toHaveLength(1)
        })

        //  **O crédito volta ao orçamento no mês de competência do ESTORNO**, que costuma ser
        //  outro mês. Agosto fica com a compra cheia e setembro recebe o crédito — corrigir
        //  agosto seria reescrever mês fechado, que o projeto recusa em todo lugar.
        it("devolve o crédito do estorno no mês da competência dele", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            //  Compra de 10/08 num cartão que fecha no 20: cai na fatura de agosto
            await createExpense(workspace, { TotalValue: 500, ExpenseDate: "2026-08-10", IdPaymentMethod: card })

            //  Estorno de 21/08: já é a fatura de setembro
            await createExpense(workspace, { TotalValue: -150, ExpenseDate: "2026-08-21", IdPaymentMethod: card })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(500)
            //  **Spent negativo é resposta legítima:** o mês só teve o crédito
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body[0].Spent).toBe(-150)
        })

        //  O rateio por pessoa sobrevive ao sinal sem tocar na fórmula: (−150 × −150) ÷ −150
        it("desce o orçamento da pessoa com o sinal do estorno", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 400,
                ExpenseDate: "2026-08-10",
                IdPaymentMethod: card,
                Persons: [{ IdPerson, Value: 400 }],
            })

            await createExpense(workspace, {
                TotalValue: -150,
                ExpenseDate: "2026-08-10",
                IdPaymentMethod: card,
                Persons: [{ IdPerson, Value: -150 }],
            })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(250)
        })

        //  Num cartão em modo 'invoice', o que pesa no mês é a fatura que vence nele — a compra
        //  do dia 21 num cartão que fecha no 20 já é do mês seguinte. Num cartão 'purchase' a
        //  mesma compra pesaria em agosto; ver Expenses.test.ts, que é onde o modo é o objeto.
        it("usa o vencimento da fatura no gasto de cartão", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createBudget(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createBudget(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 150, ExpenseDate: "2026-08-21", IdPaymentMethod: card })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].Spent).toBe(0)
            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-09`)).body[0].Spent).toBe(150)
        })
    })

    describe("POST /Budgets", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/Budgets`, {
                IdCategory: 1,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem categoria, mês ou valor", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/Budgets`, {})).status).toBe(406)
            expect((await workspace.client.post(`/Budgets`, { IdCategory: workspace.IdCategory, ReferenceMonth: "2026-08" })).status).toBe(406)
        })

        //  Teto zero é não ter teto, e isso se faz apagando o mês
        it("recusa teto zero ou negativo", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/Budgets`, buildBody(workspace, { LimitValue: 0 }))).status).toBe(406)
        })

        //  O IdCategory é sequencial e chega do cliente
        it("recusa categoria de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let stranger = await buildWorkspace()

            let response = await workspace.client.post(`/Budgets`, buildBody(workspace, { IdCategory: stranger.IdCategory }))

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await buildWorkspace()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.user.workspace.IdWorkspace))

            let response = await forged.post(`/Budgets`, buildBody(owner))

            expect(response.status).toBe(406)
            expect(await findBudgets(owner.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  As duas escritas na mesma transaction: a definição vigente e o mês congelado
        it("cria a definição e o mês de uma vez", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Budgets`, buildBody(workspace, { LimitValue: 800, AlertPercent: 90 }))

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

            let first = await workspace.client.post(`/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 }))
            let second = await workspace.client.post(`/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-09", LimitValue: 900 }))

            expect(second.status).toBe(200)
            expect(second.body.IdBudget).toBe(first.body.IdBudget)

            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
            expect(await findPeriods(first.body.IdBudget)).toHaveLength(2)
        })

        //  **A definição é a vigente; o mês fechado guarda o que valeu.** É todo o motivo de
        //  existirem duas tabelas.
        it("atualiza a definição sem reescrever o mês já cadastrado", async () => {
            let workspace = await buildWorkspace()

            let first = await workspace.client.post(`/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 }))

            await workspace.client.post(`/Budgets`, buildBody(workspace, { ReferenceMonth: "2026-09", LimitValue: 1000 }))

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

            let response = await workspace.client.post(`/Budgets`, buildBody(workspace))

            expect(response.status).toBe(406)
        })

        //  Duas categorias, dois tetos no mesmo mês
        it("aceita mais de uma categoria no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            await createBudget(workspace)
            await createBudget(workspace, { IdCategory: await createCategory(workspace, "Lazer") })

            expect((await workspace.client.get(`/Budgets?ReferenceMonth=2026-08`)).body).toHaveLength(2)
        })

        //  **Exatamente um alvo.** O `xor` do Joi barra os dois casos, e o CHECK do banco
        //  garantiria o mesmo — mas como 500.
        it("recusa corpo com os dois alvos", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            let response = await workspace.client.post(`/Budgets`, {
                IdCategory: workspace.IdCategory,
                IdPerson,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(406)
            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        it("recusa corpo sem alvo nenhum", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/Budgets`, {
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(406)
        })

        //  O IdPerson chega do cliente e é sequencial, como todo id: sem o escopo daria para
        //  orçar a pessoa do vizinho
        it("recusa pessoa de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let outro = await buildWorkspace()
            let IdPerson = await createPerson(outro, "Maria do vizinho")

            let response = await workspace.client.post(`/Budgets`, {
                IdPerson,
                ReferenceMonth: "2026-08",
                LimitValue: 500,
            })

            expect(response.status).toBe(406)
        })

        //  O índice parcial unique(IdWorkspace, IdPerson) é a garantia; esta é a resposta que
        //  diz que o conserto é editar o mês que existe
        it("recusa orçar a mesma pessoa duas vezes no mesmo mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonBudget(workspace, IdPerson)

            let response = await workspace.client.post(`/Budgets`, {
                IdPerson,
                ReferenceMonth: "2026-08",
                LimitValue: 900,
            })

            expect(response.status).toBe(406)
            expect(await findBudgets(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        //  A definição é única por alvo, e as duas colunas têm índice próprio: a mesma pessoa e
        //  a mesma categoria convivem, e o mês seguinte reencontra a definição em vez de criar
        //  outra
        it("grava a definição de pessoa com a categoria nula, e a reencontra no mês seguinte", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            let first = await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })
            let second = await createPersonBudget(workspace, IdPerson, { ReferenceMonth: "2026-09", LimitValue: 700 })

            expect(second.IdBudget).toBe(first.IdBudget)

            let [budget] = await findBudgets(workspace.user.workspace.IdWorkspace)

            expect(budget).toMatchObject({ IdPerson, IdCategory: null, LimitValue: 700 })

            //  O mês já cadastrado não se mexe: ele está congelado
            expect((await findPeriods(first.IdBudget)).map(limit)).toEqual([500, 700])
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

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            await flowClient.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })

            let methods = (await flowClient.get(`/Accounts`)).body[0].PaymentMethods
            let debit = methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod
            let category = await flowClient.post(`/Categories`, { Description: "Mercado" })

            //  Agosto: teto de 800
            let august = await flowClient.post(`/Budgets`, {
                IdCategory: category.body.IdCategory,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(august.status).toBe(200)

            let empty = await flowClient.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(empty.body[0]).toMatchObject({ LimitValue: 800, Spent: 0, AlertPercent: 80 })

            //  Duas compras no mês, uma quitada e outra não: as duas comprometem o teto
            for (let expense of [{ Value: 300, Paid: true }, { Value: 250, Paid: false }]) {
                expect((await flowClient.post(`/Expenses`, {
                    Description: "Compra do mês",
                    TotalValue: expense.Value,
                    IdCategory: category.body.IdCategory,
                    ExpenseDate: "2026-08-12",
                    Payments: [{ IdPaymentMethod: debit, Value: expense.Value, Paid: expense.Paid }],
                })).status).toBe(200)
            }

            let used = await flowClient.get(`/Budgets?ReferenceMonth=2026-08`)

            expect(used.body[0].Spent).toBe(550)
            //  O alerta é do cliente: a API entrega os três números que ele compara
            expect(used.body[0].Spent / used.body[0].LimitValue).toBeGreaterThan(0.68)

            //  O mês apertou: sobe o teto só de agosto
            expect((await flowClient.put(`/BudgetPeriods/IdBudgetPeriod=${august.body.IdBudgetPeriod}`, { LimitValue: 900 })).status).toBe(200)
            expect((await flowClient.get(`/Budgets?ReferenceMonth=2026-08`)).body[0].LimitValue).toBe(900)

            //  Setembro é cadastrado à mão — é isto que a rotina vai automatizar
            expect((await flowClient.post(`/Budgets`, {
                IdCategory: category.body.IdCategory,
                ReferenceMonth: "2026-09",
                LimitValue: 850,
            })).status).toBe(200)

            let september = await flowClient.get(`/Budgets?ReferenceMonth=2026-09`)

            //  Mês novo, gasto zerado — e agosto continua com os 900 e os 550
            expect(september.body[0]).toMatchObject({ LimitValue: 850, Spent: 0 })
            expect((await flowClient.get(`/Budgets?ReferenceMonth=2026-08`)).body[0]).toMatchObject({ LimitValue: 900, Spent: 550 })
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

    await client.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })

    let methods = (await client.get(`/Accounts`)).body[0].PaymentMethods
    let category = await client.post(`/Categories`, { Description: "Mercado" })

    return {
        user,
        client,
        IdCategory: category.body.IdCategory,
        IdDebit: methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod,
    }
}

function createPerson(workspace: TestWorkspace, Name: string) {
    return workspace.client.post(`/Persons`, { Name }).then((response) => response.body.IdPerson as number)
}

//  O corpo do orçamento de pessoa NÃO passa pelo buildBody: ele carrega o IdCategory, e mandar
//  os dois é exatamente o 406 do xor.
async function createPersonBudget(workspace: TestWorkspace, IdPerson: number, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/Budgets`, {
        IdPerson,
        ReferenceMonth: "2026-08",
        LimitValue: 500,
        ...overrides,
    })

    expect(response.status).toBe(200)

    return response.body as { IdBudget: number, IdBudgetPeriod: number }
}

function createCategory(workspace: TestWorkspace, Description: string) {
    return workspace.client.post(`/Categories`, { Description }).then((response) => response.body.IdCategory as number)
}

//  **O modo é explícito aqui de propósito.** O cadastro nasce 'purchase' — o cartão contado
//  como débito —, e nos testes de fatura abaixo o que está sob prova é a outra regra: a compra
//  pesando no mês em que a fatura vence. Deixar o default implícito faria o teste dizer uma
//  coisa e provar outra no dia em que o padrão mudasse de novo.
async function createCard(workspace: TestWorkspace, CompetenceMode: "invoice" | "purchase" = "invoice") {
    let account = (await workspace.client.get(`/Accounts`)).body[0]

    let response = await workspace.client.post(`/PaymentMethods`, {
        IdAccount: account.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: 28,
        ClosingOffsetDays: 8,
        CompetenceMode,
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
    let response = await workspace.client.post(`/Budgets`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdBudget: number, IdBudgetPeriod: number }
}

async function createExpense(workspace: TestWorkspace, overrides: Record<string, any> = {}) {
    let { Paid, IdPaymentMethod, ...rest } = overrides

    let response = await workspace.client.post(`/Expenses`, {
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

//#endregion
