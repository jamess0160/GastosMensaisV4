import { Accounts_model } from "root/routes/Accounts/Accounts.model"
import { AccountBalance } from "root/routes/Accounts/sections/AccountBalance.section"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Utils } from "root/Utils/Utils"
import { MonthTotals } from "../MonthTotals.section"

//  **Os dois indicadores do Dashboard, somados no servidor — e eles discordam de propósito.**
//
//      Available      "quanto ainda posso gastar"  -> o mês que a pessoa está vivendo
//      CurrentBalance "quanto tenho em conta"      -> o dinheiro que já saiu
//
//  Não são duas versões do mesmo fato, e é por isso que a tela mostra os dois lado a lado:
//
//  | | Posso gastar | Tenho em conta |
//  | Abertura       | o saldo realizado no fim do mês anterior | nenhuma: o saldo já é acumulado |
//  | Base de data   | competência (CompetenceDate da perna)     | caixa (CashDate)               |
//  | Base de estado | comprometido: pendente E pago            | realizado: só pago/recebido    |
//  | Entradas       | as pendentes entram                      | só as recebidas                |
//  | Unidade        | a perna, nunca o TotalValue da compra    | a perna paga                   |
//
//      Available = OpeningBalance
//                + InitialBalances                   (contas abertas dentro do mês)
//                − PastCommitments                   (pesou antes, o dinheiro ainda está lá)
//                + entradas com competência no mês   (pendentes + recebidas)
//                − pernas   com competência no mês   (pendentes + pagas)
//                + OverdueReceivable − OverduePayable
//
//  **A abertura é caixa e o fluxo é competência**, e é o `PastCommitments` que costura as duas:
//  sem ele a perna cuja compra pesa num mês e cuja fatura vence no outro é contada duas vezes
//  ou nenhuma. Ver a section, que carrega a partição inteira.
//
//  **As sections delegam, não recalculam.** O `AccountBalance` já contém as regras do saldo, e
//  o `MonthTotals` as do mês: esta section é a fórmula, e mais nada. Uma segunda implementação
//  da mesma pergunta é exatamente como duas telas passam a mostrar totais diferentes.
export class GetMonth {

    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth?: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        //  Omitir o mês é pedir o corrente, que é o que o Dashboard abre — o cliente só manda o
        //  parâmetro quando o usuário navega. Mesma regra de GET /Accounts.
        let month = Utils.monthStart(ReferenceMonth ?? Utils.currentMonth())

        //  Corte meio aberto: "até o fim do mês" é "antes do dia 1 do seguinte".
        let nextMonth = Utils.addMonthsToDate(month, 1)

        //  **Só conta ativa entra**, o mesmo filtro de GET /Accounts (o model já o aplica):
        //  senão a soma do Dashboard discorda da lista de contas na mesma tela.
        let accounts = await Accounts_model.getByWorkspace(IdWorkspace)

        //  **A abertura da conta é um fato com data, e quando essa data cai dentro do mês pedido
        //  ela é fluxo, não posição.** O front grava o `InitialBalanceDate` com o dia em que a
        //  conta foi cadastrada, então quem começa a usar o app no dia 08 tem uma conta que
        //  ainda "não existia" em 01/09: o corte zera a abertura dela no `OpeningBalance`, e o
        //  dinheiro que a pessoa tem some justamente do indicador que responde quanto ela pode
        //  gastar. Quem abre setembro com 1500 e lança 3000 de salário via 3000, tendo 4500 —
        //  o mesmo erro que o `OpeningBalance` nasceu para consertar, um mês antes.
        //
        //  **O `AccountBalance` está certo**, e é por isso que a correção não é lá: cortado em
        //  01/09 ele responde "quanto eu tinha em 31/08", e naquele dia a conta realmente não
        //  existia. Errada era esta fórmula, que usava aquela resposta para outra pergunta.
        //
        //  **É a mesma regra que o extrato já aplica**, com este mesmo filtro — ver a linha
        //  `opening` do StatementEntries, que existe exatamente porque sem ela o mês de estreia
        //  fica com abertura zero e nenhum lançamento explicando a diferença. O extrato topou
        //  nisso e resolveu; aqui, chamando o mesmo `AccountBalance`, ficou passando.
        //
        //  E o erro **não passa com o mês**: quem olhar setembro em janeiro continua vendo o mês
        //  de estreia sem o dinheiro que tinha. É história errada, não um transiente.
        let InitialBalances = this.round(accounts
            .filter((account) => Boolean(account.InitialBalanceDate)
                && account.InitialBalanceDate! >= month
                && account.InitialBalanceDate! < nextMonth)
            .reduce((total, account) => total + account.InitialBalance, 0))

        let [opening, current, totals] = await Promise.all([
            //  **O saldo de abertura não é consulta nova.** O corte do saldo é meio aberto,
            //  então o saldo cortado no *primeiro dia do mês pedido* é, por construção, o saldo
            //  no fim do mês anterior. Mesma section, outro limite.
            //
            //  Ele existe porque o cliente somava só as entradas do mês para dizer quanto ainda
            //  dava para gastar, e essa conta ignora o dinheiro que já estava na conta no dia
            //  1º: quem começa setembro com 1000 e recebe 3000 via 3000, tendo 4000.
            //
            //  E ele é **um termo da fórmula, nunca uma linha no razão**: lançar o saldo que
            //  sobrou como uma entrada contaria dobrado no próprio saldo, se repetiria todo mês
            //  como dinheiro novo, e não teria a quem atribuir no rateio. Saldo é posição;
            //  entrada é fato com data, conta e rateio.
            AccountBalance.getByAccounts(accounts, month),
            AccountBalance.getByAccounts(accounts, nextMonth),
            MonthTotals.run(IdWorkspace, month, nextMonth),
        ])

        let OpeningBalance = this.sum(opening)
        let CurrentBalance = this.sum(current)

        return {
            //  Volta como "YYYY-MM-01", como o ReferenceMonth do orçamento: o mês normalizado é
            //  o que a resposta afirma ter usado.
            ReferenceMonth: month,
            OpeningBalance,
            InitialBalances,
            Inflows: totals.Inflows,
            //  **A renda do mês aberta pelo estado**, que é como a tela do orçamento abre:
            //  "entrou X, a receber Y, total Z". Os três saem da mesma consulta, com o mesmo
            //  filtro de transferência e de cancelada — refazer a divisão no cliente seria
            //  refazer essas duas regras junto, que é o problema que esta feature existe para
            //  não ter. Os dois fecham com o `Inflows`, por construção.
            InflowsReceived: totals.InflowsReceived,
            InflowsPending: totals.InflowsPending,
            Expenses: totals.Expenses,
            PastCommitments: totals.PastCommitments,
            OverdueReceivable: totals.OverdueReceivable,
            OverduePayable: totals.OverduePayable,
            Available: this.round(
                OpeningBalance
                + InitialBalances
                - totals.PastCommitments
                + totals.Inflows
                - totals.Expenses
                + totals.OverdueReceivable
                - totals.OverduePayable,
            ),
            CurrentBalance,
            OpenInvoices: totals.OpenInvoices,
        }
    }

    private sum(balances: Map<number, number>) {
        return this.round([...balances.values()].reduce((total, balance) => total + balance, 0))
    }

    //  decimal(15,2) dos dois lados, mas a soma em ponto flutuante do JS ainda produz
    //  0.30000000000000004 — o mesmo arredondamento do AccountBalance, pelo mesmo motivo.
    private round(value: number) {
        return Math.round(value * 100) / 100
    }
}
