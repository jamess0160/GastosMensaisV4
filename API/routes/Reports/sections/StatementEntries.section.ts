import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"
import { ReportsNamespace } from "./types"

//  **As linhas do extrato — que são a abertura do saldo, não uma consulta paralela.**
//
//  É a regra que carrega a etapa, e vem direto da demanda: *o saldo no início do mês, menos o
//  que saiu, tem que dar o saldo que a tela já mostra em outro lugar*. Então estas consultas
//  são, uma a uma, as mesmas três do `AccountBalance.section.ts` — a diferença é que lá elas
//  voltam agregadas por conta e aqui voltam com as linhas:
//
//      OpeningBalance (saldo no fim do mês anterior)
//        + entradas recebidas na conta, no mês
//        − transferências recebidas que saíram da conta, no mês
//        − pernas de gasto pagas da conta, no mês
//        = ClosingBalance (o Balance que GET /Accounts devolve para este mês)
//
//  **Nenhuma regra nova nasce aqui.** Se este arquivo precisar inventar um filtro, é sinal de
//  que ele está divergindo do saldo — e aí a correção é no `AccountBalance`, para os dois lados
//  mudarem juntos.
//
//  **Só entra o que já foi liquidado** no extrato da conta: entrada recebida e perna paga. Uma
//  linha pendente no meio quebraria a soma, e um extrato que não fecha é pior do que extrato
//  nenhum. Quem quer ver a conta de luz que vence dia 25 usa `GET /Expenses`, que tem filtro de
//  status justamente para isso — extrato é o que aconteceu, previsão é outra tela.
//
//  **A transferência aparece dos dois lados, com sinais opostos, e aqui NÃO se filtra
//  `Kind='transfer'`** — o filtro que a regra "quanto entrou no mês" exige é justamente o que
//  não vale aqui: para o extrato, a transferência é uma saída real de uma conta e uma entrada
//  real na outra. É a mesma armadilha que o `AccountBalance` documenta, e como o extrato é a
//  abertura dele, ela vem junto.
class Controller {

    /**
     * As linhas de cada conta, indexadas por `IdAccount`.
     *
     * @param ReferenceMonth primeiro dia do mês — limite inclusivo
     * @param NextMonth primeiro dia do mês seguinte — limite exclusivo
     */
    public async getByAccounts(IdWorkspace: number, accounts: Database.Accounts[], ReferenceMonth: string, NextMonth: string) {
        let entries = new Map<number, ReportsNamespace.AccountEntry[]>()

        let ids = accounts.map((account) => account.IdAccount)

        for (let id of ids) entries.set(id, [])

        if (!ids.length) return entries

        let [inflows, payments] = await Promise.all([
            this.receivedInflows(IdWorkspace, ids, ReferenceMonth, NextMonth),
            this.paidPayments(IdWorkspace, ids, ReferenceMonth, NextMonth),
        ])

        //  **A abertura da conta é uma linha do extrato quando cai dentro do mês.** Sem ela a
        //  soma não fecharia: o `AccountBalance` só conta o InitialBalance a partir do
        //  InitialBalanceDate, então uma conta aberta no dia 10 tem OpeningBalance zero e
        //  ClosingBalance com o saldo inicial dentro — e nenhum lançamento explicando a
        //  diferença. É a única linha do extrato que não é lançamento nenhum, e é justamente
        //  por isso que ela precisa aparecer.
        for (let account of accounts) {
            if (!account.InitialBalanceDate) continue
            if (account.InitialBalanceDate < ReferenceMonth || account.InitialBalanceDate >= NextMonth) continue
            if (!account.InitialBalance) continue

            entries.get(account.IdAccount)!.push({
                Date: account.InitialBalanceDate,
                Kind: "opening",
                Description: "Saldo inicial",
                Value: account.InitialBalance,
            })
        }

        for (let inflow of inflows) {
            //  Uma transferência entre duas contas do mesmo workspace cai nos dois laços: sai
            //  de uma com sinal negativo e entra na outra com positivo. A soma das duas é zero,
            //  que é o que uma transferência é para o patrimônio.
            if (inflow.IdToAccount && entries.has(inflow.IdToAccount)) {
                entries.get(inflow.IdToAccount)!.push({
                    Date: inflow.CompetenceDate,
                    Kind: inflow.Kind,
                    Description: inflow.Description,
                    Value: Number(inflow.TotalValue),
                    IdInflow: inflow.IdInflow,
                })
            }

            if (inflow.IdFromAccount && entries.has(inflow.IdFromAccount)) {
                entries.get(inflow.IdFromAccount)!.push({
                    Date: inflow.CompetenceDate,
                    Kind: inflow.Kind,
                    Description: inflow.Description,
                    Value: -Number(inflow.TotalValue),
                    IdInflow: inflow.IdInflow,
                })
            }
        }

        this.pushPayments(entries, payments)

        for (let [IdAccount, list] of entries) {
            entries.set(IdAccount, list.sort(this.byDate))
        }

        return entries
    }

    /**
     * As pernas pagas viram linha — **as de cartão agrupadas por fatura, as outras uma a uma.**
     *
     * Um cartão pertence a uma conta, então quitar a fatura marca as pernas como pagas e elas
     * saem do saldo *daquela conta*. Listadas cruas, quarenta compras do cartão viram quarenta
     * linhas no extrato da conta — o que nenhum extrato bancário faz, e o que soterra as linhas
     * que importam. Então elas saem **agrupadas por cartão e por vencimento**, uma linha por
     * fatura, e o detalhe é o extrato do cartão que a tela mostra ao lado.
     *
     * **A soma não muda:** o agrupamento é de exibição, e o total do grupo é o mesmo que as
     * pernas somavam. É o que mantém o extrato fechando.
     */
    private pushPayments(entries: Map<number, ReportsNamespace.AccountEntry[]>, payments: PaidPaymentRow[]) {
        //  O agrupamento é por (cartão, vencimento) e a linha é montada uma vez só: o mapa
        //  guarda a MESMA referência que já foi empurrada na lista da conta, então somar aqui
        //  soma lá. Nada de campo auxiliar dentro da entrada — ela é a resposta, e o schema
        //  recusa chave que não descreve.
        let invoices = new Map<string, ReportsNamespace.AccountEntry>()

        for (let payment of payments) {
            let list = entries.get(payment.IdAccount)

            if (!list) continue

            //  Charged nulo é o que diz que a perna NÃO é de cartão — a mesma nulidade de
            //  ClosingDate e DueDate, e ela não depende de reler a forma de pagamento.
            if (payment.Charged === null) {
                list.push({
                    Date: payment.CashDate,
                    Kind: "expense",
                    Description: payment.Description,
                    Value: -Number(payment.Value),
                    IdExpense: payment.IdExpense,
                    IdExpensePayment: payment.IdExpensePayment,
                })

                continue
            }

            //  A fatura é o par (cartão, vencimento) e nada mais — não há tabela de faturas.
            let key = `${payment.IdPaymentMethod}|${payment.CashDate}`
            let invoice = invoices.get(key)

            if (!invoice) {
                invoice = {
                    Date: payment.CashDate,
                    Kind: "invoice",
                    Description: `Fatura ${payment.PaymentMethodName}`,
                    Value: 0,
                    IdPaymentMethod: payment.IdPaymentMethod,
                }

                invoices.set(key, invoice)
                list.push(invoice)
            }

            invoice.Value = this.round(invoice.Value - Number(payment.Value))
        }
    }

    //  Espelha o `sumReceivedInto` + `sumTransferredOut` do AccountBalance numa consulta só: as
    //  duas pontas da transferência vêm na mesma linha, e é aqui que ela vira duas entradas.
    private receivedInflows(IdWorkspace: number, ids: number[], ReferenceMonth: string, NextMonth: string) {
        return KnexConnection
            .select("IdInflow", "Description", "Kind", "TotalValue", "CompetenceDate", "IdToAccount", "IdFromAccount")
            .from<Database.Inflows>("Inflows")
            .where("IdWorkspace", IdWorkspace)
            .where("Status", "received")
            .where("CompetenceDate", ">=", ReferenceMonth)
            .where("CompetenceDate", "<", NextMonth)
            .where((query) => query.whereIn("IdToAccount", ids).orWhereIn("IdFromAccount", ids))
            .orderBy("CompetenceDate")
            .orderBy("IdInflow") as unknown as Promise<InflowRow[]>
    }

    /**
     * Espelha o `sumPaidFrom`: mesma junção, mesmos filtros, **mesmo corte pela `CashDate`**.
     *
     * A `CashDate` e não a competência porque o extrato da conta é caixa — num cartão em modo
     * `purchase` a compra pesa no mês da compra mas só sai da conta quando a fatura vence, e é
     * a saída que o extrato lista. Sem isso o extrato deixaria de fechar com o saldo, que é a
     * única coisa que ele promete.
     *
     * **Sem filtro de `Active` em PaymentMethods**, como no saldo: a compra feita num cartão
     * depois arquivado continua tendo saído da conta.
     */
    private paidPayments(IdWorkspace: number, ids: number[], ReferenceMonth: string, NextMonth: string) {
        return KnexConnection
            .select(
                "ExpensePayments.IdExpensePayment",
                "ExpensePayments.IdExpense",
                "ExpensePayments.IdPaymentMethod",
                "ExpensePayments.Value",
                "ExpensePayments.CashDate",
                "ExpensePayments.Charged",
                "PaymentMethods.IdAccount",
                { PaymentMethodName: "PaymentMethods.Name" },
                "Expenses.Description",
            )
            .from("ExpensePayments")
            .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereIn("PaymentMethods.IdAccount", ids)
            .where("ExpensePayments.Paid", true)
            //  Gasto cancelado não aparece, pela mesma razão de o saldo juntar Expenses:
            //  cancelar um gasto quitado é o estorno dele.
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.CashDate", ">=", ReferenceMonth)
            .where("ExpensePayments.CashDate", "<", NextMonth)
            .orderBy("ExpensePayments.CashDate")
            .orderBy("ExpensePayments.IdExpensePayment") as unknown as Promise<PaidPaymentRow[]>
    }

    /**
     * **O extrato do cartão é a fatura, e por isso inclui o que ainda não foi pago.**
     *
     * A assimetria com o extrato da conta é de propósito, e é a coisa mais fácil de conflatar
     * aqui:
     *
     *      extrato da conta  ->  caixa: o dinheiro que passou. SÓ liquidado
     *      extrato do cartão ->  a fatura: o que foi comprado.  pago E pendente
     *
     * Uma fatura existe antes de ser paga — é isso que a torna útil de olhar. Já o extrato da
     * conta só pode conter o que saiu, ou a soma não fecha. Os dois estão certos, e estão
     * certos por motivos opostos.
     *
     * **O corte é o `DueDate`, que é o que uma fatura é** — não a `CompetenceDate`: num cartão
     * em modo `purchase` a competência é o mês da compra, e agrupar por ela partiria a fatura
     * em pedaços que o emissor nunca cobrou. É também o que faz o total daqui bater exatamente
     * com a linha "Fatura X" do extrato da conta.
     *
     * E não há dupla contagem entre os dois: a compra aparece **detalhada** aqui e **agregada
     * na fatura** lá, no mês em que a fatura venceu. É a mesma perna, vista dos dois lados.
     *
     * **Sem filtro de `Active`:** o cartão arquivado continua tendo tido faturas.
     */
    public async getByCards(IdWorkspace: number, ReferenceMonth: string, NextMonth: string) {
        let rows = await KnexConnection
            .select(
                "ExpensePayments.IdExpensePayment",
                "ExpensePayments.IdExpense",
                "ExpensePayments.IdPaymentMethod",
                "ExpensePayments.Value",
                "ExpensePayments.DueDate",
                "ExpensePayments.InstallmentNumber",
                "ExpensePayments.InstallmentTotal",
                "ExpensePayments.Charged",
                "ExpensePayments.Paid",
                { PaymentMethodName: "PaymentMethods.Name" },
                "Expenses.Description",
                "Expenses.ExpenseDate",
            )
            .from("ExpensePayments")
            .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .where("PaymentMethods.Kind", "credit_card")
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.DueDate", ">=", ReferenceMonth)
            .where("ExpensePayments.DueDate", "<", NextMonth)
            .orderBy("ExpensePayments.DueDate")
            .orderBy("Expenses.ExpenseDate")
            .orderBy("ExpensePayments.IdExpensePayment") as unknown as CardPaymentRow[]

        let invoices = new Map<string, ReportsNamespace.CardStatement>()

        for (let row of rows) {
            let key = `${row.IdPaymentMethod}|${row.DueDate}`
            let invoice = invoices.get(key)

            if (!invoice) {
                invoice = {
                    IdPaymentMethod: row.IdPaymentMethod,
                    Name: row.PaymentMethodName,
                    DueDate: row.DueDate,
                    Total: 0,
                    Entries: [],
                }

                invoices.set(key, invoice)
            }

            invoice.Total = this.round(invoice.Total + Number(row.Value))

            invoice.Entries.push({
                //  A data da linha da fatura é a da **compra**, não a do vencimento: é ela que
                //  o usuário reconhece ao conferir com o app do cartão.
                Date: row.ExpenseDate,
                Description: row.Description,
                Value: Number(row.Value),
                IdExpense: row.IdExpense,
                IdExpensePayment: row.IdExpensePayment,
                InstallmentNumber: row.InstallmentNumber,
                InstallmentTotal: row.InstallmentTotal,
                Paid: row.Paid,
                Charged: Boolean(row.Charged),
            })
        }

        return [...invoices.values()]
    }

    //  Por data, e o id desempata: duas linhas do mesmo dia precisam de ordem estável, senão a
    //  tela embaralha a cada requisição.
    private byDate(left: ReportsNamespace.AccountEntry, right: ReportsNamespace.AccountEntry) {
        if (left.Date !== right.Date) return left.Date < right.Date ? -1 : 1

        return (left.IdInflow ?? left.IdExpensePayment ?? 0) - (right.IdInflow ?? right.IdExpensePayment ?? 0)
    }

    private round(value: number) {
        return Math.round(value * 100) / 100
    }
}

interface InflowRow {
    IdInflow: number
    Description: string
    Kind: "inflow" | "transfer"
    TotalValue: number
    CompetenceDate: string
    IdToAccount: number | null
    IdFromAccount: number | null
}

interface PaidPaymentRow {
    IdExpensePayment: number
    IdExpense: number
    IdPaymentMethod: number
    Value: number
    CashDate: string
    Charged: boolean | null
    IdAccount: number
    PaymentMethodName: string
    Description: string
}

interface CardPaymentRow {
    IdExpensePayment: number
    IdExpense: number
    IdPaymentMethod: number
    Value: number
    DueDate: string
    InstallmentNumber: number | null
    InstallmentTotal: number | null
    Charged: boolean | null
    Paid: boolean
    PaymentMethodName: string
    Description: string
    ExpenseDate: string
}

export const StatementEntries = new Controller()
