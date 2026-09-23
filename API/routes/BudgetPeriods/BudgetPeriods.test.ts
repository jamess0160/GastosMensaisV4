import { TestClient, TestDatabase, TestUser, UsersFactory } from "root/Utils/Tests"

//  Testes integrados de BudgetPeriods — **o orçamento como repartição da renda de um mês**. Um
//  describe por rota de BudgetPeriods.route.ts, mais o fluxo end to end no fim.
//
//  A suíte de `Budgets` foi absorvida por esta na leva 9, junto com a feature: o teto perene
//  por alvo e a rotina que o congelava no dia 1º acabaram, e o que sobrou é a linha do mês —
//  a única coisa que o usuário de fato escreve.
//
//  Quatro coisas carregam o arquivo:
//
//  1. **os três formatos de alvo** — só categoria, só pessoa, e pessoa + categoria. O terceiro
//     é o que o `xor` antigo proibia, e é a razão da etapa: "250 para o Tiago em alimentação";
//  2. **a unicidade de cada formato** — três índices parciais e não uma unique sobre as quatro
//     colunas, porque NULL não conflita com NULL. "Mercado" e "Maria em Mercado" convivem no
//     mesmo mês, e cada um deles duas vezes é 406;
//  3. **qualquer mês** — passado, corrente ou futuro. Nada nasce de rotina, então outubro em
//     setembro é só um POST;
//  4. **mês fechado recusa escrita** — o `ClosedAt` que a rotina carimba é a trava que impede
//     reescrever a história de agosto em novembro.
//
//  E o comprometido, que é o que dá sentido ao número ao lado: a parcela conta no mês em que
//  vence, e o pendente conta junto com o pago, ao contrário do saldo.

describe("BudgetPeriods", () => {

    let root: TestUser
    let client: TestClient
    let other: TestUser
    let otherClient: TestClient

    beforeAll(async () => {
        //  CASCADE: truncar Users leva Workspaces, Categories e BudgetPeriods junto
        await TestDatabase.truncate(["Users"])

        root = await UsersFactory.create({ Name: "Dono dos orçamentos" })
        client = new TestClient(root.token)

        other = await UsersFactory.create({ Name: "Usuário de outro workspace" })
        otherClient = new TestClient(other.token)
    })

    describe("GET /BudgetPeriods", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, root.workspace.IdWorkspace))

            let response = await forged.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(406)
        })

        //  O mês é a unidade aqui, ao contrário das listagens de movimento
        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08-01`)).status).toBe(406)
            expect((await workspace.client.get(`/BudgetPeriods`)).status).toBe(406)
        })

        it("devolve lista vazia quando o mês não tem orçamento", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body.Periods).toEqual([])
        })

        it("devolve a fatia do mês com a categoria e o comprometido zerado", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body.Periods).toHaveLength(1)
            expect(response.body.Periods[0]).toMatchObject({
                LimitValue: 800,
                AlertPercent: 80,
                //  Nasce aberto: fechar o mês é trabalho da rotina do dia 1º
                Status: "open",
                ClosedAt: null,
                //  Sempre o dia 1 do mês
                ReferenceMonth: "2026-08-01",
                IdPerson: null,
                Person: null,
                Spent: 0,
            })
            expect(response.body.Periods[0].Category.Description).toBe("Mercado")
        })

        //  Cada mês é uma lista: o de agosto não aparece na consulta de setembro
        it("devolve só o mês pedido", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 900 })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods.map(limit)).toEqual([800])
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods.map(limit)).toEqual([900])
        })

        //  **Qualquer mês responde, e nada nasce sozinho.** Era o furo do modelo anterior:
        //  `BudgetPeriods` só nascia pela rotina do dia 1º, então navegar para outubro em
        //  setembro devolvia lista vazia e não havia como montar o mês que vem.
        it("lê o mês futuro que foi montado à mão", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2027-03", LimitValue: 1200 })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2027-03`)).body.Periods.map(limit)).toEqual([1200])
        })

        it("não devolve o orçamento de outro workspace", async () => {
            let owner = await buildWorkspace()

            await createPeriod(owner)

            expect((await otherClient.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods).toEqual([])
        })

        //  **O número que dá sentido à fatia.** Gasto lançado no mês, na categoria orçada.
        it("soma o gasto do mês na categoria orçada", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-08-10" })
            await createExpense(workspace, { TotalValue: 120.5, ExpenseDate: "2026-08-28" })
            //  Fora do mês e fora da categoria não entram
            await createExpense(workspace, { TotalValue: 999, ExpenseDate: "2026-09-02" })
            await createExpense(workspace, { TotalValue: 999, ExpenseDate: "2026-08-15", IdCategory: await createCategory(workspace, "Lazer") })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.body.Periods[0].Spent).toBe(420.5)
        })

        //  Orçamento é **comprometido**, não realizado: o gasto lançado e ainda não quitado já
        //  consumiu a fatia. É o oposto do saldo da conta, que só soma perna paga.
        it("conta o gasto pendente junto com o pago", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 100, ExpenseDate: "2026-08-10", Paid: true })
            await createExpense(workspace, { TotalValue: 200, ExpenseDate: "2026-08-11" })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(300)
        })

        it("não conta gasto cancelado", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            let canceled = await createExpense(workspace, { TotalValue: 300, ExpenseDate: "2026-08-10" })

            await workspace.client.delete(`/Expenses/IdExpense=${canceled.IdExpense}`)

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(0)
        })

        //  **A parcela pesa no mês em que vence, não no mês da compra.** Somar os 600 em agosto
        //  estouraria a fatia por uma dívida que é de meio ano.
        it("distribui a compra parcelada pelos meses das parcelas", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
            })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(100)
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods[0].Spent).toBe(100)
        })

        //  **O teste que sustenta a decisão do rateio.** Sem ele, o mesmo gasto contaria 600
        //  na fatia da pessoa e 100 na da categoria, e "quanto a Maria comprometeu em agosto"
        //  não teria resposta certa.
        it("rateia a parcela pelo rateio do gasto: 600 em 6x da Maria dão 100 no mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonPeriod(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson, Value: 600 }],
            })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body.Periods).toHaveLength(1)
            //  100, não 600: o rateio é do gasto e a parcela é da perna
            expect(response.body.Periods[0].Spent).toBe(100)
        })

        //  **O mesmo dinheiro conta UMA vez, e é a fatia da pessoa que o come.** Era o furo que
        //  o alvo duplo abriu: até a etapa 9 esta compra comia 250 da fatia de Mercado **e**
        //  250 da fatia da Maria — 500 consumidos de uma repartição por um gasto de 250.
        //
        //  A porção tem dono, e **porção com dono nunca sai do bolso dela**: procura (Maria,
        //  Mercado), não acha, cai na mesada (Maria, sem categoria) e para aí. A fatia de
        //  Mercado segue em zero, e é isso mesmo.
        it("conta a mesma compra uma vez só, na fatia da pessoa", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPersonPeriod(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 250,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson, Value: 250 }],
            })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.body.Periods).toHaveLength(2)
            //  A de categoria primeiro (foi criada antes): zero. A da pessoa: os 250 inteiros.
            expect(response.body.Periods.map((item: { Spent: number }) => item.Spent)).toEqual([0, 250])
            expect(response.body.Unbudgeted).toBe(0)
        })

        //  O rateio arredonda **uma vez, no fim**: a divisão em numeric do Postgres tem
        //  precisão de sobra, e arredondar por parcela espalharia o erro.
        it("arredonda o rateio uma vez, no fim", async () => {
            let workspace = await buildWorkspace()
            let maria = await createPerson(workspace, "Maria")
            let joao = await createPerson(workspace, "João")

            await createPersonPeriod(workspace, maria, { ReferenceMonth: "2026-08", LimitValue: 500 })
            await createPersonPeriod(workspace, joao, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, {
                TotalValue: 600,
                Kind: "installment",
                InstallmentTotal: 6,
                ExpenseDate: "2026-08-10",
                Persons: [{ IdPerson: maria, Value: 400 }, { IdPerson: joao, Value: 200 }],
            })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            let byPerson = new Map(response.body.Periods.map((item: { IdPerson: number }) => [item.IdPerson, item]))

            expect((byPerson.get(maria) as { Spent: number }).Spent).toBe(66.67)
            expect((byPerson.get(joao) as { Spent: number }).Spent).toBe(33.33)
        })

        //  **Parece bug e não é.** Persons é opcional no gasto, então a soma das fatias de
        //  pessoa não fecha com o total gasto do mês.
        it("não conta na fatia de pessoa o gasto sem rateio", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPersonPeriod(workspace, IdPerson, { ReferenceMonth: "2026-08", LimitValue: 500 })

            await createExpense(workspace, { TotalValue: 250, ExpenseDate: "2026-08-10" })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            let byTarget = new Map(response.body.Periods.map((item: { IdPerson: number | null }) => [item.IdPerson, item]))

            //  A categoria enxerga o gasto inteiro; a pessoa não enxerga nada
            expect((byTarget.get(null) as { Spent: number }).Spent).toBe(250)
            expect((byTarget.get(IdPerson) as { Spent: number }).Spent).toBe(0)
        })

        //  **Os três formatos na mesma lista.** É o exemplo que definiu o modelo, com 1.000
        //  recebidos: Luana 250, Tiago em Alimentação 250, Mercado 500.
        it("devolve os três formatos de alvo na mesma lista, com o alvo inteiro", async () => {
            let workspace = await buildWorkspace()
            let luana = await createPerson(workspace, "Luana")
            let tiago = await createPerson(workspace, "Tiago")
            let alimentacao = await createCategory(workspace, "Alimentação")

            await createPersonPeriod(workspace, luana, { LimitValue: 250 })
            await postPeriod(workspace, { IdPerson: tiago, IdCategory: alimentacao, LimitValue: 250 })
            await createPeriod(workspace, { LimitValue: 500 })

            let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(response.status).toBe(200)
            expect(response.body.Periods).toHaveLength(3)

            let [onlyPerson, both, onlyCategory] = response.body.Periods

            expect(onlyPerson).toMatchObject({ IdPerson: luana, IdCategory: null, Category: null, LimitValue: 250 })
            expect(onlyPerson.Person.Name).toBe("Luana")

            expect(both).toMatchObject({ IdPerson: tiago, IdCategory: alimentacao, LimitValue: 250 })
            expect(both.Person.Name).toBe("Tiago")
            expect(both.Category.Description).toBe("Alimentação")

            expect(onlyCategory).toMatchObject({ IdPerson: null, Person: null, IdCategory: workspace.IdCategory, LimitValue: 500 })

            //  As fatias **somam lado a lado**: é a repartição dos 1.000 do mês
            expect(response.body.Periods.reduce((total: number, item: { LimitValue: number }) => total + item.LimitValue, 0)).toBe(1000)
        })

        //  O alvo arquivado perde o que mostrar e sai da tela, mas a linha continua no banco —
        //  arquivar não é apagar, e o mês é histórico
        it("esconde do mês a fatia de pessoa arquivada", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            let created = await createPersonPeriod(workspace, IdPerson, { LimitValue: 500 })

            await workspace.client.delete(`/Persons/IdPerson=${IdPerson}`)

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods).toHaveLength(0)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  **O crédito volta ao orçamento no mês de competência do ESTORNO**, que costuma ser
        //  outro mês. Agosto fica com a compra cheia e setembro recebe o crédito.
        it("devolve o crédito do estorno no mês da competência dele", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            //  Compra de 10/08 num cartão que fecha no 20: cai na fatura de agosto
            await createExpense(workspace, { TotalValue: 500, ExpenseDate: "2026-08-10", IdPaymentMethod: card })

            //  Estorno de 21/08: já é a fatura de setembro
            await createExpense(workspace, { TotalValue: -150, ExpenseDate: "2026-08-21", IdPaymentMethod: card })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(500)
            //  **Spent negativo é resposta legítima:** o mês só teve o crédito
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods[0].Spent).toBe(-150)
        })

        //  O rateio por pessoa sobrevive ao sinal sem tocar na fórmula: (−150 × −150) ÷ −150
        it("desce a fatia da pessoa com o sinal do estorno", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonPeriod(workspace, IdPerson, { LimitValue: 500 })

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

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(250)
        })

        //  Num cartão em modo 'invoice', o que pesa no mês é a fatura que vence nele — a compra
        //  do dia 21 num cartão que fecha no 20 já é do mês seguinte.
        it("usa o vencimento da fatura no gasto de cartão", async () => {
            let workspace = await buildWorkspace()
            let card = await createCard(workspace)

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 800 })

            await createExpense(workspace, { TotalValue: 150, ExpenseDate: "2026-08-21", IdPaymentMethod: card })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods[0].Spent).toBe(0)
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods[0].Spent).toBe(150)
        })

        //  **Cada porção de gasto consome UMA fatia, ou nenhuma** — nunca duas. A porção é o
        //  cruzamento de uma perna com uma pessoa do rateio; o gasto sem rateio tem uma porção
        //  só, da perna inteira, com pessoa nula.
        //
        //  | a porção                      | procura, nesta ordem            | e se não achar   |
        //  |-------------------------------|---------------------------------|------------------|
        //  | **tem pessoa P**, categoria C | `(P, C)` → `(P, sem categoria)` | não consome nada |
        //  | **sem pessoa**, categoria C   | `(sem pessoa, C)`               | não consome nada |
        //
        //  Os testes daqui são o exemplo que definiu a regra: 1.000 de renda repartidos em
        //  `#1 (Luana, —) 250`, `#2 (Tiago, Alimentação) 250` e `#3 (—, Mercado) 500`.
        describe("O casamento da porção com a fatia", () => {

            //  Os quatro gastos do exemplo, cada um achando (ou não) a sua fatia
            it("casa cada um dos quatro gastos do exemplo com a fatia dele", async () => {
                let workspace = await buildWorkspace()
                let example = await buildAllocationExample(workspace)

                //  bate pessoa E categoria -> #2
                await createExpense(workspace, { TotalValue: 100, IdCategory: example.alimentacao, Persons: [{ IdPerson: example.tiago, Value: 100 }] })
                //  não há (Luana, Mercado); há (Luana, —) -> #1
                await createExpense(workspace, { TotalValue: 100, Persons: [{ IdPerson: example.luana, Value: 100 }] })
                //  sem pessoa, em Mercado -> #3
                await createExpense(workspace, { TotalValue: 300 })
                //  sem pessoa, numa categoria que ninguém orçou -> nenhuma
                await createExpense(workspace, { TotalValue: 1000, IdCategory: example.casa })

                let month = await readMonth(workspace)

                expect(month.spent.get(example.tiagoFood)).toBe(100)
                expect(month.spent.get(example.luanaPeriod)).toBe(100)
                expect(month.spent.get(example.mercado)).toBe(300)
                //  **O preço da regra estrita, visível em vez de silencioso**
                expect(month.Unbudgeted).toBe(1000)

                //  A conta que o usuário confere sozinho: nada de dinheiro se perde no meio
                expect(month.total + month.Unbudgeted).toBe(1500)
            })

            //  **O caso decidido junto com o exemplo, e o que mais dói:** não existe (Tiago,
            //  Mercado), o #2 é do Tiago **só para Alimentação**, e a porção com dono não cai
            //  no #3. Uma porção com dono nunca sai do bolso dela — se caísse, a fatia de
            //  categoria voltaria a ser um segundo teto sobre o mesmo dinheiro.
            it("não deixa a porção com dono cair na fatia de categoria", async () => {
                let workspace = await buildWorkspace()
                let example = await buildAllocationExample(workspace)

                await createExpense(workspace, { TotalValue: 100, Persons: [{ IdPerson: example.tiago, Value: 100 }] })

                let month = await readMonth(workspace)

                expect(month.spent.get(example.luanaPeriod)).toBe(0)
                expect(month.spent.get(example.tiagoFood)).toBe(0)
                expect(month.spent.get(example.mercado)).toBe(0)
                expect(month.Unbudgeted).toBe(100)
            })

            //  **Um gasto, duas porções, duas fatias diferentes.** É o rateio do eixo analítico
            //  fazendo o que ele existe para fazer, e cada metade procura a fatia dela por
            //  conta própria: a do Tiago acha o par exato, a da Luana cai na mesada.
            it("reparte o gasto de duas pessoas entre as fatias que cada uma encontra", async () => {
                let workspace = await buildWorkspace()
                let example = await buildAllocationExample(workspace)

                await createExpense(workspace, {
                    TotalValue: 200,
                    IdCategory: example.alimentacao,
                    Persons: [{ IdPerson: example.luana, Value: 120 }, { IdPerson: example.tiago, Value: 80 }],
                })

                let month = await readMonth(workspace)

                expect(month.spent.get(example.luanaPeriod)).toBe(120)
                expect(month.spent.get(example.tiagoFood)).toBe(80)
                expect(month.spent.get(example.mercado)).toBe(0)
                expect(month.Unbudgeted).toBe(0)
            })

            //  **A porção é da PERNA, não da compra.** 600 em 6x rateados 400/200 não comem
            //  400 e 200 de agosto: comem a parte de cada um **naquela parcela**, 66,67 e
            //  33,33, e os dois juntos dão exatamente os 100 da perna.
            it("a porção é da perna: o parcelado casa mês a mês", async () => {
                let workspace = await buildWorkspace()
                let example = await buildAllocationExample(workspace)

                await createExpense(workspace, {
                    TotalValue: 600,
                    Kind: "installment",
                    InstallmentTotal: 6,
                    IdCategory: example.alimentacao,
                    Persons: [{ IdPerson: example.tiago, Value: 400 }, { IdPerson: example.luana, Value: 200 }],
                })

                let month = await readMonth(workspace)

                expect(month.spent.get(example.tiagoFood)).toBe(66.67)
                expect(month.spent.get(example.luanaPeriod)).toBe(33.33)
                expect(month.Unbudgeted).toBe(0)
                //  A soma das porções do mês é a perna inteira, não a compra
                expect(month.total).toBe(100)
            })

            //  Um mês que ninguém montou não tem o gasto "zerado": ele está **todo** fora do
            //  orçamento, e é essa a resposta certa.
            it("põe o gasto inteiro fora do orçamento num mês sem fatia nenhuma", async () => {
                let workspace = await buildWorkspace()

                await createExpense(workspace, { TotalValue: 420.5 })

                let month = await readMonth(workspace)

                expect(month.Periods).toHaveLength(0)
                expect(month.Unbudgeted).toBe(420.5)
            })
        })
    })

    describe("POST /BudgetPeriods", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/BudgetPeriods`, {
                IdCategory: 1,
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(401)
        })

        it("recusa corpo sem mês ou valor", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/BudgetPeriods`, {})).status).toBe(406)
            expect((await workspace.client.post(`/BudgetPeriods`, { IdCategory: workspace.IdCategory, ReferenceMonth: "2026-08" })).status).toBe(406)
        })

        //  **Sem alvo nenhum continua sendo 406.** O CHECK virou "pelo menos um", não "nenhum":
        //  um valor que não diz do que é não soma contra coisa nenhuma.
        it("recusa corpo sem alvo nenhum", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods`, {
                ReferenceMonth: "2026-08",
                LimitValue: 800,
            })

            expect(response.status).toBe(406)
        })

        //  Valor zero é não ter a fatia, e isso se faz apagando a linha
        it("recusa valor zero ou negativo", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { LimitValue: 0 }))).status).toBe(406)
            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { LimitValue: -1 }))).status).toBe(406)
        })

        //  O IdCategory é sequencial e chega do cliente
        it("recusa categoria de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let stranger = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { IdCategory: stranger.IdCategory }))

            expect(response.status).toBe(406)
        })

        //  O IdPerson chega do cliente e é sequencial, como todo id
        it("recusa pessoa de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let outro = await buildWorkspace()
            let IdPerson = await createPerson(outro, "Maria do vizinho")

            let response = await workspace.client.post(`/BudgetPeriods`, {
                IdPerson,
                ReferenceMonth: "2026-08",
                LimitValue: 500,
            })

            expect(response.status).toBe(406)
        })

        it("recusa token válido apontando para o workspace de outro usuário", async () => {
            let owner = await buildWorkspace()
            let forged = new TestClient(UsersFactory.buildToken(other.user.IdUser, owner.user.workspace.IdWorkspace))

            let response = await forged.post(`/BudgetPeriods`, buildBody(owner))

            expect(response.status).toBe(406)
            expect(await findPeriods(owner.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  Ser membro não basta: montar o mês é escrita, e o viewer só lê
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.post(`/BudgetPeriods`, buildBody(owner))

            expect(response.status).toBe(403)
            expect(await findPeriods(owner.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  **Uma escrita só.** Eram duas até a leva 9 — a definição vigente e o mês congelado.
        it("grava a fatia de categoria", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { LimitValue: 800, AlertPercent: 90 }))

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ IdBudgetPeriod: expect.any(Number) })

            let [period] = await findPeriods(workspace.user.workspace.IdWorkspace)

            expect(period).toMatchObject({
                IdCategory: workspace.IdCategory,
                IdPerson: null,
                ReferenceMonth: "2026-08-01",
                LimitValue: 800,
                AlertPercent: 90,
                Status: "open",
            })
        })

        it("grava a fatia de pessoa com a categoria nula", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonPeriod(workspace, IdPerson, { LimitValue: 500 })

            let [period] = await findPeriods(workspace.user.workspace.IdWorkspace)

            expect(period).toMatchObject({ IdPerson, IdCategory: null, LimitValue: 500 })
        })

        //  **O formato que o `xor` antigo proibia**, e a razão inteira da etapa.
        it("grava a fatia de pessoa E categoria", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Tiago")
            let IdCategory = await createCategory(workspace, "Alimentação")

            let response = await postPeriod(workspace, { IdPerson, IdCategory, LimitValue: 250 })

            expect(response.IdBudgetPeriod).toEqual(expect.any(Number))

            expect(await findPeriodById(response.IdBudgetPeriod)).toMatchObject({ IdPerson, IdCategory, LimitValue: 250 })
        })

        //  **Os três formatos convivem no mesmo mês**, e é para isso que são três índices
        //  parciais em vez de uma unique sobre as quatro colunas.
        it("aceita os três formatos de alvo no mesmo mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Luana")

            await createPeriod(workspace, { LimitValue: 500 })
            await createPersonPeriod(workspace, IdPerson, { LimitValue: 250 })
            await postPeriod(workspace, { IdPerson, IdCategory: workspace.IdCategory, LimitValue: 100 })

            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(3)
        })

        //  **"Mercado" e "Luana em Mercado" não são o mesmo alvo.** A segunda não é um teto
        //  dentro da primeira: as duas somam lado a lado, e a repetição que o índice barra é a
        //  do alvo inteiro.
        it("não confunde a fatia da categoria com a de pessoa + a mesma categoria", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Luana")

            await createPeriod(workspace, { LimitValue: 500 })

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { IdPerson, LimitValue: 100 }))

            expect(response.status).toBe(200)
        })

        it("recusa a mesma categoria duas vezes no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace)

            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace))).status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        it("recusa a mesma pessoa duas vezes no mesmo mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPersonPeriod(workspace, IdPerson)

            let response = await workspace.client.post(`/BudgetPeriods`, {
                IdPerson,
                ReferenceMonth: "2026-08",
                LimitValue: 900,
            })

            expect(response.status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        it("recusa o mesmo par pessoa + categoria duas vezes no mesmo mês", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Tiago")

            await postPeriod(workspace, { IdPerson, IdCategory: workspace.IdCategory, LimitValue: 250 })

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { IdPerson, LimitValue: 300 }))

            expect(response.status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        //  Duas categorias, duas fatias no mesmo mês
        it("aceita mais de uma categoria no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace)
            await createPeriod(workspace, { IdCategory: await createCategory(workspace, "Lazer") })

            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods).toHaveLength(2)
        })

        //  A mesma categoria em dois meses é duas linhas, e uma não sabe da outra: não há mais
        //  definição perene por trás delas.
        it("aceita a mesma categoria em meses diferentes, com valores diferentes", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 1000 })

            expect((await findPeriods(workspace.user.workspace.IdWorkspace)).map(limit)).toEqual([800, 1000])
        })

        //  **Outubro pode ser montado em setembro**, e março de 2025 também. Nenhum dos dois
        //  tinha como existir enquanto o mês nascia da rotina do dia 1º.
        it("monta qualquer mês, passado ou futuro", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { ReferenceMonth: "2025-03" }))).status).toBe(200)
            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { ReferenceMonth: "2027-12" }))).status).toBe(200)
        })

        //  **Mês fechado não aceita escrita.** É a trava que impede montar uma fatia em agosto
        //  depois que a virada de setembro já o encerrou.
        it("recusa a fatia nova em mês fechado", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })
            await closeMonth(workspace, "2026-08-01")

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, {
                IdCategory: await createCategory(workspace, "Lazer"),
            }))

            expect(response.status).toBe(403)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(1)
        })

        //  Um mês sem linha nenhuma nunca foi fechado: não houve o que encerrar, e registrar um
        //  mês passado agora é caminho normal.
        it("aceita montar um mês passado que nunca teve orçamento", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08" })
            await closeMonth(workspace, "2026-08-01")

            expect((await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { ReferenceMonth: "2026-07" }))).status).toBe(200)
        })
    })

    //  **Repetir a repartição de um mês no outro.** É o desconto do preço que a leva 9 cobrou
    //  ao matar a rotina do dia 1º: nada nasce sozinho, então remontar em outubro as mesmas
    //  linhas de setembro é trabalho repetido todo mês.
    //
    //  O que a suíte trava são as três exclusões e a recusa — pular o alvo que já existe, pular
    //  o arquivado, recusar o destino fechado — e a **idempotência**, que é o que faz o botão
    //  clicado duas vezes não ser um estrago.
    describe("POST /BudgetPeriods/clone", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(406)
        })

        //  Copiar é escrever, e viewer não escreve
        it("recusa o viewer", async () => {
            let workspace = await buildWorkspace()
            let viewerClient = await buildViewerClient(workspace)

            await createPeriod(workspace, { LimitValue: 800 })

            let response = await viewerClient.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(403)
        })

        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08-01", To: "2026-09" })).status).toBe(406)
            expect((await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08" })).status).toBe(406)
        })

        //  Todo alvo já existe no destino, então a rota responderia 200 com lista vazia e
        //  esconderia do cliente uma chamada montada errada
        it("recusa clonar o mês nele mesmo", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            expect((await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-08" })).status).toBe(406)
        })

        it("recusa quando a origem não tem orçamento nenhum", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(406)
        })

        //  O caso de aceite: em setembro, navegar para outubro e trazer as linhas de setembro
        it("copia as fatias do mês de origem com o mesmo alvo e o mesmo valor", async () => {
            let workspace = await buildWorkspace()
            let example = await buildAllocationExample(workspace)

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods).toHaveLength(3)

            let september = await readMonth(workspace, "2026-09")

            //  Os três formatos de alvo atravessam a cópia: só pessoa, pessoa + categoria, e
            //  só categoria
            expect(september.Periods.map((period: any) => ({
                IdCategory: period.IdCategory,
                IdPerson: period.IdPerson,
                LimitValue: period.LimitValue,
                ReferenceMonth: period.ReferenceMonth,
                Status: period.Status,
            }))).toEqual([
                { IdCategory: null, IdPerson: example.luana, LimitValue: 250, ReferenceMonth: "2026-09-01", Status: "open" },
                { IdCategory: example.alimentacao, IdPerson: example.tiago, LimitValue: 250, ReferenceMonth: "2026-09-01", Status: "open" },
                { IdCategory: workspace.IdCategory, IdPerson: null, LimitValue: 500, ReferenceMonth: "2026-09-01", Status: "open" },
            ])

            //  A origem fica intacta: copiar não move nada de lugar
            expect((await readMonth(workspace, "2026-08")).Periods).toHaveLength(3)
        })

        //  O AlertPercent é parte da fatia, não um padrão do formulário
        it("copia o AlertPercent junto", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800, AlertPercent: 60 })

            await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect((await readMonth(workspace, "2026-09")).Periods[0]).toMatchObject({ AlertPercent: 60 })
        })

        //  **Clonar duas vezes não duplica nem sobrescreve.** O valor que já está no mês é uma
        //  decisão que alguém tomou, e uma cópia não tem autoridade para desfazê-la — é a mesma
        //  escolha que a materialização velha fazia ao só inserir o que faltava.
        it("não duplica nem sobrescreve ao clonar de novo", async () => {
            let workspace = await buildWorkspace()

            let source = await createPeriod(workspace, { LimitValue: 800 })

            await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            //  A fatia de setembro é corrigida à mão: é ela que a segunda cópia não pode tocar
            let copied = (await readMonth(workspace, "2026-09")).Periods[0]
            await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${copied.IdBudgetPeriod}`, { LimitValue: 300 })

            let second = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(second.status).toBe(200)
            expect(second.body.IdBudgetPeriods).toEqual([])

            let september = await readMonth(workspace, "2026-09")

            expect(september.Periods).toHaveLength(1)
            expect(september.Periods[0]).toMatchObject({ IdBudgetPeriod: copied.IdBudgetPeriod, LimitValue: 300 })
            expect((await findPeriodById(source.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  **O alvo INTEIRO é a chave, não uma das duas colunas:** "Mercado" e "Maria em
        //  Mercado" são fatias diferentes do mesmo mês, então a segunda não pode ser pulada
        //  por causa da primeira já estar no destino.
        it("traz o alvo duplo mesmo com a categoria dele já orçada no destino", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await postPeriod(workspace, { ReferenceMonth: "2026-08", IdPerson, IdCategory: workspace.IdCategory, LimitValue: 200 })

            //  Setembro já tem a fatia só de categoria
            await createPeriod(workspace, { ReferenceMonth: "2026-09", LimitValue: 900 })

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.body.IdBudgetPeriods).toHaveLength(1)

            let september = (await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods

            expect(september).toHaveLength(2)
            //  A de categoria pura ficou com o valor que já tinha em setembro
            expect(september.map(limit)).toEqual([900, 200])
        })

        //  Categoria ou pessoa que saiu das listas não volta pela porta dos fundos
        it("pula o alvo arquivado entre um mês e outro", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")
            let IdCategory = await createCategory(workspace, "Lazer")

            await createPeriod(workspace, { LimitValue: 800 })
            await createPersonPeriod(workspace, IdPerson, { LimitValue: 500 })
            await createPeriod(workspace, { IdCategory, LimitValue: 100 })

            await workspace.client.delete(`/Persons/IdPerson=${IdPerson}`)
            await workspace.client.delete(`/Categories/IdCategory=${IdCategory}`)

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods).toHaveLength(1)

            let september = await readMonth(workspace, "2026-09")

            expect(september.Periods).toHaveLength(1)
            expect(september.Periods[0]).toMatchObject({ IdCategory: workspace.IdCategory, IdPerson: null, LimitValue: 800 })
        })

        //  **403 e não 406**, como as outras três escritas da feature: o workspace e o papel
        //  estão certos, o que falta é o mês estar aberto
        it("recusa o destino fechado, sem escrever linha nenhuma", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await createPeriod(workspace, { ReferenceMonth: "2026-09", IdCategory: await createCategory(workspace, "Lazer"), LimitValue: 100 })
            await closeMonth(workspace, "2026-09-01")

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(403)
            expect((await readMonth(workspace, "2026-09")).Periods).toHaveLength(1)
        })

        //  **Origem fechada serve de modelo.** Fechado quer dizer "não se escreve mais nele", e
        //  ler agosto para montar dezembro não escreve em agosto — recusar aqui tiraria
        //  justamente o mês mais provável de servir de modelo.
        it("aceita a origem fechada", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            await closeMonth(workspace, "2026-08-01")

            let response = await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })

            expect(response.status).toBe(200)
            //  A cópia nasce ABERTA: o carimbo do mês de origem não vem junto, ou o destino
            //  já nasceria travado contra a edição que a cópia existe para poupar
            expect((await readMonth(workspace, "2026-09")).Periods[0]).toMatchObject({ Status: "open", ClosedAt: null })
        })

        //  O mês de destino não precisa ser o seguinte: montar dezembro a partir de agosto é a
        //  mesma operação, e é o que "qualquer mês é editável" quer dizer
        it("copia para um mês qualquer, não só o seguinte", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })

            expect((await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-12" })).status).toBe(200)
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-12`)).body.Periods.map(limit)).toEqual([800])
        })

        //  O id chega do cliente em nenhum lugar aqui, mas o mês chega — e o workspace do
        //  token é o único filtro que separa o orçamento de um tenant do do vizinho
        it("não enxerga o orçamento de outro workspace", async () => {
            let workspace = await buildWorkspace()
            let neighbour = await buildWorkspace()

            await createPeriod(neighbour, { LimitValue: 800 })

            expect((await workspace.client.post(`/BudgetPeriods/clone`, { From: "2026-08", To: "2026-09" })).status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })
    })

    //  **O rateio do mês inteiro numa escrita só** — o gesto da tela do orçamento.
    //
    //  O que este describe trava é a diferença entre esta rota e as outras três: o corpo é o mês
    //  DEPOIS da escrita, e não um lote de criações. A linha que sumiu da lista é apagada
    //  (fisicamente, como o DELETE de uma linha só), a que ficou é atualizada NO LUGAR — mesmo
    //  IdBudgetPeriod —, e a que mudou de alvo não é caso à parte: ela é uma remoção mais uma
    //  inserção, porque a identidade de uma fatia é o alvo e não o id.
    describe("POST /BudgetPeriods/allocate", () => {

        it("recusa sem token", async () => {
            let response = await client.anonymous().post(`/BudgetPeriods/allocate`, { ReferenceMonth: "2026-08", Lines: [] })

            expect(response.status).toBe(401)
        })

        it("recusa sessão sem workspace selecionado", async () => {
            let response = await new TestClient(UsersFactory.buildToken(root.user.IdUser)).post(`/BudgetPeriods/allocate`, { ReferenceMonth: "2026-08", Lines: [] })

            expect(response.status).toBe(406)
        })

        //  Ratear é escrever, e viewer não escreve
        it("recusa o viewer", async () => {
            let workspace = await buildWorkspace()
            let viewerClient = await buildViewerClient(workspace)

            let response = await viewerClient.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: workspace.IdCategory, LimitValue: 800 }],
            })

            expect(response.status).toBe(403)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        it("recusa mês fora do formato YYYY-MM", async () => {
            let workspace = await buildWorkspace()

            expect((await workspace.client.post(`/BudgetPeriods/allocate`, { ReferenceMonth: "2026-08-01", Lines: [] })).status).toBe(406)
            expect((await workspace.client.post(`/BudgetPeriods/allocate`, { Lines: [] })).status).toBe(406)
        })

        //  **A linha sem alvo nenhum é 406, e o mês não é tocado.** Um valor que não diz do que é
        //  não soma contra coisa nenhuma — e o CHECK do banco garantiria o mesmo, mas como 500.
        it("recusa a linha sem alvo nenhum, sem escrever o resto da lista", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [
                    { IdCategory: workspace.IdCategory, LimitValue: 800 },
                    { LimitValue: 200 },
                ],
            })

            expect(response.status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  O Joi valida item a item e não enxerga o conjunto: sem a conferência da section, a
        //  segunda linha do mesmo alvo estouraria o índice parcial como 500 — ou sobrescreveria
        //  a primeira calada, gravando um rateio diferente do que a tela mostrava.
        it("recusa duas linhas para o mesmo alvo", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [
                    { IdCategory: workspace.IdCategory, LimitValue: 800 },
                    { IdCategory: workspace.IdCategory, LimitValue: 200 },
                ],
            })

            expect(response.status).toBe(406)
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  **"Mercado" e "Maria em Mercado" NÃO são o mesmo alvo**, e as duas convivem no mesmo
        //  mês: a segunda não é um teto dentro da primeira — elas somam lado a lado.
        it("aceita a categoria pura e o alvo duplo da mesma categoria na mesma lista", async () => {
            let workspace = await buildWorkspace()
            let IdPerson = await createPerson(workspace, "Maria")

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [
                    { IdCategory: workspace.IdCategory, LimitValue: 800 },
                    { IdCategory: workspace.IdCategory, IdPerson, LimitValue: 200 },
                ],
            })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods).toHaveLength(2)
        })

        //  Os dois ids chegam do cliente e são sequenciais: o de outro tenant é 406, e o
        //  arquivado cai no mesmo lugar — orçar quem sumiu do rateio é orçar o que nada alimenta
        it("recusa o alvo de outro workspace e o alvo arquivado", async () => {
            let workspace = await buildWorkspace()
            let neighbour = await buildWorkspace()
            let archived = await createCategory(workspace, "Lazer")

            await workspace.client.delete(`/Categories/IdCategory=${archived}`)

            expect((await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: neighbour.IdCategory, LimitValue: 800 }],
            })).status).toBe(406)

            expect((await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: archived, LimitValue: 800 }],
            })).status).toBe(406)

            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  O caso de aceite: o mês vazio recebe o rateio inteiro, com os três formatos de alvo
        it("grava o rateio de um mês vazio, na ordem do corpo", async () => {
            let workspace = await buildWorkspace()
            let luana = await createPerson(workspace, "Luana")
            let tiago = await createPerson(workspace, "Tiago")
            let alimentacao = await createCategory(workspace, "Alimentação")

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [
                    { IdPerson: luana, LimitValue: 250 },
                    { IdPerson: tiago, IdCategory: alimentacao, LimitValue: 250, AlertPercent: 60 },
                    { IdCategory: workspace.IdCategory, LimitValue: 500 },
                ],
            })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods).toHaveLength(3)

            let august = await readMonth(workspace, "2026-08")

            expect(august.Periods.map((period: any) => ({
                IdCategory: period.IdCategory,
                IdPerson: period.IdPerson,
                LimitValue: period.LimitValue,
                AlertPercent: period.AlertPercent,
                ReferenceMonth: period.ReferenceMonth,
                Status: period.Status,
            }))).toEqual([
                { IdCategory: null, IdPerson: luana, LimitValue: 250, AlertPercent: 80, ReferenceMonth: "2026-08-01", Status: "open" },
                { IdCategory: alimentacao, IdPerson: tiago, LimitValue: 250, AlertPercent: 60, ReferenceMonth: "2026-08-01", Status: "open" },
                { IdCategory: workspace.IdCategory, IdPerson: null, LimitValue: 500, AlertPercent: 80, ReferenceMonth: "2026-08-01", Status: "open" },
            ])
        })

        //  **Realocar SUBSTITUI o mês**, e cada linha sabe o que lhe cabe: a que ficou é
        //  atualizada no lugar — mesmo IdBudgetPeriod, mesmo CreatedAt —, a que sumiu da lista é
        //  apagada fisicamente, e a nova é inserida.
        it("substitui o mês: atualiza a que ficou, apaga a que sumiu e insere a nova", async () => {
            let workspace = await buildWorkspace()
            let lazer = await createCategory(workspace, "Lazer")
            let casa = await createCategory(workspace, "Casa")

            let mercado = await createPeriod(workspace, { LimitValue: 800 })
            let removido = await createPeriod(workspace, { IdCategory: lazer, LimitValue: 100 })

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [
                    { IdCategory: workspace.IdCategory, LimitValue: 600 },
                    { IdCategory: casa, LimitValue: 300 },
                ],
            })

            expect(response.status).toBe(200)

            let august = await readMonth(workspace, "2026-08")

            //  A linha que ficou conservou o id: trocar 800 por 600 em "Mercado" não é uma fatia
            //  nova, e a identidade dela é o alvo
            expect(response.body.IdBudgetPeriods[0]).toBe(mercado.IdBudgetPeriod)
            expect(august.Periods.map((period: any) => period.LimitValue)).toEqual([600, 300])

            //  Delete FÍSICO, como o DELETE de uma linha só: a fatia é plano, não lançamento
            expect(await findPeriodById(removido.IdBudgetPeriod)).toBeUndefined()
        })

        //  **Mudar de alvo não é um caso à parte**: é a remoção do alvo antigo mais a inserção
        //  do novo, que é exatamente o que o PUT já obriga ao recusar alvo no corpo.
        it("trata a linha que mudou de alvo como remoção mais inserção", async () => {
            let workspace = await buildWorkspace()
            let lazer = await createCategory(workspace, "Lazer")

            let antigo = await createPeriod(workspace, { LimitValue: 800 })

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: lazer, LimitValue: 800 }],
            })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods[0]).not.toBe(antigo.IdBudgetPeriod)
            expect(await findPeriodById(antigo.IdBudgetPeriod)).toBeUndefined()
            expect((await readMonth(workspace, "2026-08")).Periods.map((period: any) => period.IdCategory)).toEqual([lazer])
        })

        //  **A lista vazia é legítima**, ao contrário do lote da Renda: é o usuário apagando
        //  todas as linhas e salvando — "este mês não tem orçamento" é uma resposta.
        it("aceita a lista vazia e limpa o mês", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { LimitValue: 800 })

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, { ReferenceMonth: "2026-08", Lines: [] })

            expect(response.status).toBe(200)
            expect(response.body.IdBudgetPeriods).toEqual([])
            expect(await findPeriods(workspace.user.workspace.IdWorkspace)).toHaveLength(0)
        })

        //  **A fatia de alvo arquivado sobrevive ao rateio**, e tem que sobreviver: o GET não a
        //  devolve — sem nome e sem cor não há o que mostrar —, então ela nunca esteve na tela e
        //  o cliente não tem como reenviá-la. Apagá-la aqui seria perder, calada, uma linha que
        //  ninguém viu.
        it("não apaga a fatia cujo alvo foi arquivado", async () => {
            let workspace = await buildWorkspace()
            let lazer = await createCategory(workspace, "Lazer")

            let escondida = await createPeriod(workspace, { IdCategory: lazer, LimitValue: 100 })
            await workspace.client.delete(`/Categories/IdCategory=${lazer}`)

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: workspace.IdCategory, LimitValue: 800 }],
            })

            expect(response.status).toBe(200)
            expect(await findPeriodById(escondida.IdBudgetPeriod)).toMatchObject({ LimitValue: 100 })
            //  E ela continua invisível: o mês da tela é só a linha que o rateio escreveu
            expect((await readMonth(workspace, "2026-08")).Periods.map((period: any) => period.LimitValue)).toEqual([800])
        })

        //  **403 e não 406**, como as outras escritas da feature: o workspace e o papel estão
        //  certos, o que falta é o mês estar aberto — e nada é escrito
        it("recusa o mês fechado, sem escrever linha nenhuma", async () => {
            let workspace = await buildWorkspace()

            let period = await createPeriod(workspace, { LimitValue: 800 })
            await closeMonth(workspace, "2026-08-01")

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: workspace.IdCategory, LimitValue: 600 }],
            })

            expect(response.status).toBe(403)
            expect((await findPeriodById(period.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  **O rateio do orçamento NÃO precisa fechar**, ao contrário dos dois eixos do gasto:
        //  esta rota não lê a renda do mês para responder, então nem sobrar nem estourar é
        //  recusa. Quem avisa do estouro é a tela.
        it("não confere a soma contra coisa nenhuma", async () => {
            let workspace = await buildWorkspace()

            let response = await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-08",
                Lines: [{ IdCategory: workspace.IdCategory, LimitValue: 999999.99 }],
            })

            expect(response.status).toBe(200)
        })

        //  Qualquer mês é rateável: nada nasce de rotina, então outubro em setembro é só esta
        //  chamada
        it("rateia um mês futuro sem tocar no corrente", async () => {
            let workspace = await buildWorkspace()

            await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })

            expect((await workspace.client.post(`/BudgetPeriods/allocate`, {
                ReferenceMonth: "2026-12",
                Lines: [{ IdCategory: workspace.IdCategory, LimitValue: 300 }],
            })).status).toBe(200)

            expect((await readMonth(workspace, "2026-08")).Periods.map((period: any) => period.LimitValue)).toEqual([800])
            expect((await readMonth(workspace, "2026-12")).Periods.map((period: any) => period.LimitValue)).toEqual([300])
        })
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
        //  conferida no próprio tenant liberaria mexer na fatia do vizinho
        it("recusa o período de outro workspace", async () => {
            let owner = await buildWorkspace()
            let created = await createPeriod(owner, { LimitValue: 800 })

            let response = await otherClient.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1 })

            expect(response.status).toBe(406)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  Ser membro não basta: mexer no valor é escrita, e o viewer só lê. 403, não 406 —
        //  aqui o workspace existe para ele, o que falta é o papel.
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createPeriod(owner, { LimitValue: 800 })
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1 })

            expect(response.status).toBe(403)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  Cada linha é uma fatia independente: corrigir dezembro não vaza para agosto
        it("muda o valor só daquela fatia", async () => {
            let workspace = await buildWorkspace()

            let august = await createPeriod(workspace, { ReferenceMonth: "2026-08", LimitValue: 800 })
            let december = await createPeriod(workspace, { ReferenceMonth: "2026-12", LimitValue: 800 })

            let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${december.IdBudgetPeriod}`, {
                LimitValue: 1500,
                AlertPercent: 95,
            })

            expect(response.status).toBe(200)
            expect(await findPeriodById(december.IdBudgetPeriod)).toMatchObject({ LimitValue: 1500, AlertPercent: 95 })

            expect((await findPeriodById(august.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        it("recusa mês ou alvo no corpo", async () => {
            let workspace = await buildWorkspace()
            let created = await createPeriod(workspace)

            expect((await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                LimitValue: 900,
                ReferenceMonth: "2026-09-01",
            })).status).toBe(406)

            expect((await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                LimitValue: 900,
                IdCategory: workspace.IdCategory,
            })).status).toBe(406)
        })

        //  Valor zero é não ter a fatia, e isso se faz apagando a linha — não zerando o número
        it("recusa valor zerado ou negativo", async () => {
            let workspace = await buildWorkspace()
            let created = await createPeriod(workspace, { LimitValue: 800 })

            for (let LimitValue of [0, -100]) {
                let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue })

                expect(response.status).toBe(406)
            }

            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
        })

        //  O alerta é percentual do valor: fora de 1..100, ou quebrado, ele não significa nada
        it("recusa AlertPercent fora da faixa", async () => {
            let workspace = await buildWorkspace()
            let created = await createPeriod(workspace)

            for (let AlertPercent of [0, 101, 80.5]) {
                let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, {
                    LimitValue: 900,
                    AlertPercent,
                })

                expect(response.status).toBe(406)
            }
        })

        //  **Mês fechado não aceita escrita** — é o que impede reescrever a história de agosto
        //  em novembro, e a única coisa que ainda separa o mês vivido do que já passou.
        it("recusa corrigir a fatia de um mês fechado", async () => {
            let workspace = await buildWorkspace()
            let created = await createPeriod(workspace, { LimitValue: 800 })

            await closeMonth(workspace, "2026-08-01")

            let response = await workspace.client.put(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`, { LimitValue: 1500 })

            expect(response.status).toBe(403)
            expect((await findPeriodById(created.IdBudgetPeriod)).LimitValue).toBe(800)
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
            let created = await createPeriod(owner)

            let response = await otherClient.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(406)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  Delete físico é justamente o que o viewer não pode disparar: não há Active para
        //  desfazer depois
        it("recusa membro viewer", async () => {
            let owner = await buildWorkspace()
            let created = await createPeriod(owner)
            let viewerClient = await buildViewerClient(owner)

            let response = await viewerClient.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(403)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })

        //  Delete físico, ao contrário de toda tabela de cadastro: a fatia é plano, não
        //  lançamento. E nada sobrevive a ela — não há mais definição perene por trás.
        it("apaga a fatia", async () => {
            let workspace = await buildWorkspace()

            let created = await createPeriod(workspace)

            let response = await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(200)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeUndefined()
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods).toEqual([])
        })

        //  Apagar um mês não leva os outros junto: o delete é por id, e cada mês é uma linha
        it("não mexe nos outros meses da mesma categoria", async () => {
            let workspace = await buildWorkspace()

            let august = await createPeriod(workspace, { ReferenceMonth: "2026-08" })
            let september = await createPeriod(workspace, { ReferenceMonth: "2026-09" })

            expect((await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${august.IdBudgetPeriod}`)).status).toBe(200)

            expect(await findPeriodById(september.IdBudgetPeriod)).toBeDefined()
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-09`)).body.Periods).toHaveLength(1)
        })

        //  Apagada a fatia, o alvo pode ser orçado de novo naquele mês
        it("libera o alvo para uma fatia nova no mesmo mês", async () => {
            let workspace = await buildWorkspace()

            let created = await createPeriod(workspace, { LimitValue: 800 })

            await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, { LimitValue: 500 }))

            expect(response.status).toBe(200)
            expect((await workspace.client.get(`/BudgetPeriods?ReferenceMonth=2026-08`)).body.Periods.map(limit)).toEqual([500])
        })

        //  Delete é escrita, e mês fechado não aceita escrita — aqui com mais razão, já que o
        //  delete é físico e não há como desfazê-lo
        it("recusa apagar a fatia de um mês fechado", async () => {
            let workspace = await buildWorkspace()
            let created = await createPeriod(workspace)

            await closeMonth(workspace, "2026-08-01")

            let response = await workspace.client.delete(`/BudgetPeriods/IdBudgetPeriod=${created.IdBudgetPeriod}`)

            expect(response.status).toBe(403)
            expect(await findPeriodById(created.IdBudgetPeriod)).toBeDefined()
        })
    })

    describe("Fluxo end to end", () => {

        //  O mês de uso do orçamento, só por HTTP: reparte a renda do mês nos três formatos,
        //  gasta, acompanha o comprometido, corrige uma fatia, monta o mês seguinte antes de
        //  ele chegar e confirma que o mês fechado recusa a escrita.
        it("reparte a renda do mês, acompanha o comprometido e monta o mês seguinte", async () => {
            let payload = {
                Name: "Usuário do fluxo de orçamento",
                Email: UsersFactory.buildEmail(),
                Password: "Senha@123",
                Phone: 549987654321,
                AcceptedTerms: true,
            }

            expect((await new TestClient().post("/Users", payload)).status).toBe(200)

            let flowClient = new TestClient()

            expect((await flowClient.login(payload.Email, payload.Password)).status).toBe(200)

            await flowClient.post(`/Accounts`, { Name: "Conta corrente", InitialBalance: 5000 })

            let methods = (await flowClient.get(`/Accounts`)).body[0].PaymentMethods
            let debit = methods.find((item: { Kind: string }) => item.Kind === "debit").IdPaymentMethod
            let mercado = (await flowClient.post(`/Categories`, { Description: "Mercado" })).body.IdCategory
            let alimentacao = (await flowClient.post(`/Categories`, { Description: "Alimentação" })).body.IdCategory
            let tiago = (await flowClient.post(`/Persons`, { Name: "Tiago" })).body.IdPerson
            let luana = (await flowClient.post(`/Persons`, { Name: "Luana" })).body.IdPerson

            //  Agosto: os 1.000 do mês repartidos em três fatias — uma por formato de alvo
            let fatias = [
                { IdPerson: luana, LimitValue: 250 },
                { IdPerson: tiago, IdCategory: alimentacao, LimitValue: 250 },
                { IdCategory: mercado, LimitValue: 500 },
            ]

            let created: number[] = []

            for (let fatia of fatias) {
                let response = await flowClient.post(`/BudgetPeriods`, { ReferenceMonth: "2026-08", ...fatia })

                expect(response.status).toBe(200)

                created.push(response.body.IdBudgetPeriod)
            }

            let month = await flowClient.get(`/BudgetPeriods?ReferenceMonth=2026-08`)

            expect(month.body.Periods).toHaveLength(3)
            expect(month.body.Periods.reduce((total: number, item: { LimitValue: number }) => total + item.LimitValue, 0)).toBe(1000)
            expect(month.body.Periods.map((item: { Spent: number }) => item.Spent)).toEqual([0, 0, 0])
            expect(month.body.Unbudgeted).toBe(0)

            //  Duas compras de mercado no mês, uma quitada e outra não: as duas comprometem
            for (let expense of [{ Value: 300, Paid: true }, { Value: 250, Paid: false }]) {
                expect((await flowClient.post(`/Expenses`, {
                    Description: "Compra do mês",
                    TotalValue: expense.Value,
                    IdCategory: mercado,
                    ExpenseDate: "2026-08-12",
                    Payments: [{ IdPaymentMethod: debit, Value: expense.Value, Paid: expense.Paid }],
                })).status).toBe(200)
            }

            let used = await flowClient.get(`/BudgetPeriods?ReferenceMonth=2026-08`)
            let mercadoRow = used.body.Periods.find((item: { IdCategory: number | null, IdPerson: number | null }) => item.IdCategory === mercado && item.IdPerson === null)

            expect(mercadoRow.Spent).toBe(550)
            //  As duas compras são sem rateio, então as duas acharam a fatia de Mercado: nada
            //  ficou de fora, e a soma fecha com o gasto do mês.
            expect(used.body.Unbudgeted).toBe(0)
            //  O alerta é do cliente: a API entrega os três números que ele compara
            expect(mercadoRow.Spent / mercadoRow.LimitValue).toBeGreaterThan(0.68)

            //  O mês apertou: sobe a fatia de mercado
            expect((await flowClient.put(`/BudgetPeriods/IdBudgetPeriod=${mercadoRow.IdBudgetPeriod}`, { LimitValue: 600 })).status).toBe(200)
            expect((await flowClient.get(`/BudgetPeriods?ReferenceMonth=2026-08`))
                .body.Periods.find((item: { IdBudgetPeriod: number }) => item.IdBudgetPeriod === mercadoRow.IdBudgetPeriod).LimitValue).toBe(600)

            //  **Setembro é montado antes de setembro chegar** — o que o modelo anterior não
            //  tinha como oferecer, porque o mês só nascia na virada do dia 1º
            expect((await flowClient.post(`/BudgetPeriods`, {
                IdCategory: mercado,
                ReferenceMonth: "2026-09",
                LimitValue: 450,
            })).status).toBe(200)

            let september = await flowClient.get(`/BudgetPeriods?ReferenceMonth=2026-09`)

            expect(september.body.Periods).toHaveLength(1)
            expect(september.body.Periods[0]).toMatchObject({ LimitValue: 450, Spent: 0 })

            //  A virada fecha agosto, e agosto para de aceitar escrita
            await TestDatabase.connection()
                .update({ Status: "closed", ClosedAt: new Date() })
                .from("BudgetPeriods")
                .where("ReferenceMonth", "2026-08-01")
                .whereIn("IdBudgetPeriod", created)

            expect((await flowClient.put(`/BudgetPeriods/IdBudgetPeriod=${created[0]}`, { LimitValue: 1 })).status).toBe(403)
            expect((await flowClient.delete(`/BudgetPeriods/IdBudgetPeriod=${created[0]}`)).status).toBe(403)

            //  Setembro segue aberto e editável
            expect((await flowClient.put(`/BudgetPeriods/IdBudgetPeriod=${september.body.Periods[0].IdBudgetPeriod}`, { LimitValue: 500 })).status).toBe(200)
        })
    })
})

//#region Arranjo

interface TestWorkspace {
    user: TestUser
    client: TestClient
    /** Todo arranjo já nasce com uma categoria e uma forma de pagamento: a fatia precisa de
     *  alvo, e o comprometido precisa de gasto. */
    IdCategory: number
    IdDebit: number
}

//  Cada teste arruma o seu workspace, porque a leitura do mês devolve tudo que existe nele
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

//  Um segundo usuário matriculado como viewer no workspace de quem chamou. A matrícula vai
//  direto ao banco — sem ela o assertRole nunca é exercitado.
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

async function createPeriod(workspace: TestWorkspace, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/BudgetPeriods`, buildBody(workspace, overrides))

    expect(response.status).toBe(200)

    return response.body as { IdBudgetPeriod: number }
}

//  O corpo da fatia de pessoa NÃO passa pelo buildBody: ele carrega o IdCategory, e a fatia de
//  pessoa pura é justamente a que não tem categoria nenhuma.
async function createPersonPeriod(workspace: TestWorkspace, IdPerson: number, overrides: Record<string, unknown> = {}) {
    let response = await workspace.client.post(`/BudgetPeriods`, {
        IdPerson,
        ReferenceMonth: "2026-08",
        LimitValue: 500,
        ...overrides,
    })

    expect(response.status).toBe(200)

    return response.body as { IdBudgetPeriod: number }
}

/**
 * **O exemplo que definiu a regra do casamento**, montado por HTTP: 1.000 de renda repartidos
 * em três fatias, uma de cada formato de alvo —
 *
 *     #1 (Luana, —)              250
 *     #2 (Tiago, Alimentação)    250
 *     #3 (—, Mercado)            500
 *
 * `Casa` nasce junto e **de propósito sem fatia**: é a categoria que prova o "fora do
 * orçamento". `Mercado` é a categoria que todo workspace do arranjo já tem.
 */
async function buildAllocationExample(workspace: TestWorkspace) {
    let luana = await createPerson(workspace, "Luana")
    let tiago = await createPerson(workspace, "Tiago")
    let alimentacao = await createCategory(workspace, "Alimentação")
    let casa = await createCategory(workspace, "Casa")

    let luanaPeriod = (await createPersonPeriod(workspace, luana, { LimitValue: 250 })).IdBudgetPeriod
    let tiagoFood = (await postPeriod(workspace, { IdPerson: tiago, IdCategory: alimentacao, LimitValue: 250 })).IdBudgetPeriod
    let mercado = (await createPeriod(workspace, { LimitValue: 500 })).IdBudgetPeriod

    return { luana, tiago, alimentacao, casa, luanaPeriod, tiagoFood, mercado }
}

//  O corpo livre, para o formato de alvo duplo e para o que não cabe nos dois helpers acima
async function postPeriod(workspace: TestWorkspace, body: Record<string, unknown>) {
    let response = await workspace.client.post(`/BudgetPeriods`, { ReferenceMonth: "2026-08", ...body })

    expect(response.status).toBe(200)

    return response.body as { IdBudgetPeriod: number }
}

function createPerson(workspace: TestWorkspace, Name: string) {
    return workspace.client.post(`/Persons`, { Name }).then((response) => response.body.IdPerson as number)
}

function createCategory(workspace: TestWorkspace, Description: string) {
    return workspace.client.post(`/Categories`, { Description }).then((response) => response.body.IdCategory as number)
}

//  **Nenhuma rota fecha um mês** — quem fecha é a rotina do dia 1º, e é ela que este UPDATE
//  imita. Fazê-lo por HTTP seria inventar uma rota que o app não tem, e é justamente a ausência
//  dela que faz o `ClosedAt` significar "o tempo passou", não "alguém clicou".
async function closeMonth(workspace: TestWorkspace, ReferenceMonth: string) {
    await TestDatabase.connection()
        .update({ Status: "closed", ClosedAt: new Date() })
        .from("BudgetPeriods")
        .where("IdWorkspace", workspace.user.workspace.IdWorkspace)
        .where("ReferenceMonth", ReferenceMonth)
}

//  **O modo é explícito de propósito.** O cadastro nasce 'purchase' — o cartão contado como
//  débito —, e nos testes de fatura o que está sob prova é a outra regra: a compra pesando no
//  mês em que a fatura vence.
async function createCard(workspace: TestWorkspace, CompetenceMode: "invoice" | "purchase" = "invoice") {
    let account = (await workspace.client.get(`/Accounts`)).body[0]

    let response = await workspace.client.post(`/PaymentMethods`, {
        IdAccount: account.IdAccount,
        Name: "Cartão",
        Kind: "credit_card",
        DueDay: 28,
        ClosingDay: 20,
        CompetenceMode,
    })

    return response.body.IdPaymentMethod as number
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

/**
 * O mês lido pelo id da fatia, e não pela posição na lista: com cinco fatias possíveis e uma
 * regra de precedência entre elas, `body.Periods[0]` vira adivinhação.
 *
 * `total` é a soma dos `Spent`, e ela existe por causa da conta que fecha a regra:
 * **soma dos `Spent` + `Unbudgeted` = o gasto do mês inteiro**.
 */
async function readMonth(workspace: TestWorkspace, ReferenceMonth = "2026-08") {
    let response = await workspace.client.get(`/BudgetPeriods?ReferenceMonth=${ReferenceMonth}`)

    expect(response.status).toBe(200)

    let Periods = response.body.Periods as Array<{ IdBudgetPeriod: number, Spent: number }>

    return {
        Periods,
        spent: new Map(Periods.map((item): [number, number] => [item.IdBudgetPeriod, item.Spent])),
        total: Periods.reduce((sum, item) => sum + item.Spent, 0),
        Unbudgeted: response.body.Unbudgeted as number,
    }
}

function findPeriods(IdWorkspace: number) {
    return TestDatabase.connection().select("*").from("BudgetPeriods").where("IdWorkspace", IdWorkspace).orderBy("IdBudgetPeriod")
}

function findPeriodById(IdBudgetPeriod: number) {
    return TestDatabase.connection().select("*").from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod).first()
}

//#endregion
