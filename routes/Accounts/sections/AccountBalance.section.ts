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
//  Recebe a lista de contas e devolve um mapa: são três consultas agrupadas, não três por
//  conta, senão o GET com dez contas viraria trinta consultas.
class Controller {

    public async getByAccounts(accounts: Database.Accounts[]) {
        let ids = accounts.map((account) => account.IdAccount)

        let balances = new Map<number, number>()

        if (!ids.length) return balances

        let [received, transferredOut, paid] = await Promise.all([
            this.sumReceivedInto(ids),
            this.sumTransferredOut(ids),
            this.sumPaidFrom(ids),
        ])

        for (let account of accounts) {
            let balance = account.InitialBalance
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
    private async sumReceivedInto(ids: number[]) {
        let rows = await KnexConnection
            .select("IdToAccount")
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .whereIn("IdToAccount", ids)
            .where("Status", "received")
            .groupBy("IdToAccount") as Array<{ IdToAccount: number, Total: number }>

        return new Map(rows.map((row) => [row.IdToAccount, Number(row.Total)]))
    }

    //  A outra ponta da transferência. Esquecer esta consulta é o erro clássico: o dinheiro
    //  apareceria na conta de destino sem nunca ter saído da de origem.
    private async sumTransferredOut(ids: number[]) {
        let rows = await KnexConnection
            .select("IdFromAccount")
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .whereIn("IdFromAccount", ids)
            .where("Status", "received")
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
    private async sumPaidFrom(ids: number[]) {
        let rows = await KnexConnection
            .select("PaymentMethods.IdAccount")
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .whereIn("PaymentMethods.IdAccount", ids)
            .where("ExpensePayments.Paid", true)
            .whereNot("Expenses.Status", "canceled")
            .groupBy("PaymentMethods.IdAccount") as Array<{ IdAccount: number, Total: number }>

        return new Map(rows.map((row) => [row.IdAccount, Number(row.Total)]))
    }
}

export const AccountBalance = new Controller()
