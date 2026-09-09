import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"
import { Database } from "root/Utils/database"

//  O saldo da conta, **sempre calculado**, nunca guardado (decisão 1 do ROADMAP):
//
//      saldo = InitialBalance
//            + Inflows recebidos com IdToAccount   = conta
//            − Inflows recebidos com IdFromAccount = conta      (transferência que saiu)
//            − ExpensePayments pagos cuja forma de pagamento é da conta
//
//  A coluna CurrentBalance existia e foi derrubada: mantê-la em dia seria toda rota que mexe em
//  dinheiro lembrar de recalcular (criar, editar, cancelar, receber, estornar, quitar,
//  desquitar), e esquecer uma não quebra nada — só faz o saldo divergir devagar. Saldo
//  plausível e errado é a pior falha possível aqui.
//
//  **A transferência conta nas duas pontas neste cálculo**, ao contrário do total de "quanto
//  entrou no mês", que exclui Kind='transfer'. Duas regras opostas sobre a mesma coluna: é o
//  ponto mais fácil de conflatar do modelo, e é por isso que este cálculo mora num lugar só.
//
//  **O saldo tem data de corte: é sempre o saldo *até o fim de um mês*.** Estado (`received`,
//  `Paid`) não é data — nada impede marcar como recebida uma entrada com CompetenceDate em
//  setembro, e sem corte esse dinheiro apareceria no saldo de agosto. O corte é meio aberto
//  (`< primeiro dia do mês seguinte`), como em BudgetSpent: não precisa saber quantos dias tem
//  o mês, e o dia 31 não escapa de um `between` mal montado.
//
//  A data que vale é a do lançamento, nunca `ReceivedAt`/`PaidAt` — aqueles são o instante do
//  clique, então quitar hoje a fatura de setembro jogaria a saída no mês errado. Mas ela é
//  **outra em cada lado**, e a diferença nasceu com o `CompetenceMode`:
//
//      entrada       ->  CompetenceDate
//      perna de gasto ->  CashDate, o vencimento quando existe, senão o dia do gasto
//
//  Saldo é **caixa**, e caixa é quando o dinheiro sai. Num cartão em modo `purchase` a compra
//  de 20/08 *pesa* em agosto (é isso que o modo faz) e *sai da conta* em 05/09, com a fatura —
//  cortar o saldo pela competência tiraria de agosto um dinheiro que só saiu em setembro, e
//  todo saldo de mês passado ficaria errado. A competência é do orçamento e do "posso gastar";
//  aqui manda a `CashDate`.
//
//  Recebe a lista de contas e devolve um mapa: são três consultas agrupadas, não três por
//  conta, senão o GET com dez contas viraria trinta consultas.
class Controller {

    /** @param NextMonth primeiro dia do mês seguinte ao pedido — limite exclusivo do corte. */
    public async getByAccounts(accounts: Database.Accounts[], NextMonth: string) {
        let ids = accounts.map((account) => account.IdAccount)

        let balances = new Map<number, number>()

        if (!ids.length) return balances

        let [received, transferredOut, paid] = await Promise.all([
            this.sumReceivedInto(ids, NextMonth),
            this.sumTransferredOut(ids, NextMonth),
            this.sumPaidFrom(ids, NextMonth),
        ])

        for (let account of accounts) {
            //  A abertura também respeita o corte: uma conta aberta em agosto não tinha saldo
            //  nenhum em março. Sem data de abertura não há o que cortar — a conta sempre
            //  existiu, do ponto de vista do sistema.
            let opening = account.InitialBalanceDate && account.InitialBalanceDate >= NextMonth
                ? 0
                : account.InitialBalance

            let balance = opening
                + (received.get(account.IdAccount) ?? 0)
                - (transferredOut.get(account.IdAccount) ?? 0)
                - (paid.get(account.IdAccount) ?? 0)

            //  decimal(15,2) dos dois lados, mas a soma em ponto flutuante do JS ainda produz
            //  0.30000000000000004. Arredondar no centavo é o que faz o saldo fechar na tela.
            balances.set(account.IdAccount, Math.round(balance * 100) / 100)
        }

        return balances
    }

    //  Tudo que caiu na conta: entrada de fora e transferência que chegou. Só o recebido — o
    //  pendente é previsão, não saldo.
    private async sumReceivedInto(ids: number[], NextMonth: string) {
        let rows = await KnexConnection
            .select("IdToAccount")
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .whereIn("IdToAccount", ids)
            .where("Status", "received")
            .where("CompetenceDate", "<", NextMonth)
            .groupBy("IdToAccount") as Array<{ IdToAccount: number, Total: number }>

        return new Map(rows.map((row) => [row.IdToAccount, Number(row.Total)]))
    }

    //  A outra ponta da transferência. Esquecer esta consulta é o erro clássico: o dinheiro
    //  apareceria na conta de destino sem nunca ter saído da de origem.
    private async sumTransferredOut(ids: number[], NextMonth: string) {
        let rows = await KnexConnection
            .select("IdFromAccount")
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .whereIn("IdFromAccount", ids)
            .where("Status", "received")
            .where("CompetenceDate", "<", NextMonth)
            .groupBy("IdFromAccount") as Array<{ IdFromAccount: number, Total: number }>

        return new Map(rows.map((row) => [row.IdFromAccount, Number(row.Total)]))
    }

    //  O gasto sai da conta pela forma de pagamento, e só quando a perna está paga: a compra
    //  parcelada no cartão só tira do saldo a parcela que já foi quitada.
    //
    //  **O join com Expenses existe pelo Status:** cancelar um gasto já quitado é o estorno
    //  dele, e sem esta cláusula o dinheiro sairia da conta para sempre — as pernas continuam
    //  gravadas com Paid=true, que é o fato histórico, mas um gasto cancelado não move saldo.
    //  É o espelho do Status='received' do lado das entradas.
    //
    //  Sem filtro de Active em PaymentMethods: a compra feita num cartão depois arquivado
    //  continua tendo saído da conta.
    private async sumPaidFrom(ids: number[], NextMonth: string) {
        let rows = await KnexConnection
            .select("PaymentMethods.IdAccount")
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .whereIn("PaymentMethods.IdAccount", ids)
            .where("ExpensePayments.Paid", true)
            .whereNot("Expenses.Status", "canceled")
            //  **CashDate, não CompetenceDate**: aqui é o dinheiro saindo da conta, e num
            //  cartão em modo 'purchase' as duas datas divergem de propósito. Ver o cabeçalho.
            .where("ExpensePayments.CashDate", "<", NextMonth)
            .groupBy("PaymentMethods.IdAccount") as Array<{ IdAccount: number, Total: number }>

        return new Map(rows.map((row) => [row.IdAccount, Number(row.Total)]))
    }
}

export const AccountBalance = new Controller()
