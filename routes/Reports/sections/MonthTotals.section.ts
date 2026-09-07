import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"

//  **Os totais do mês, cada um com a sua regra — e as regras se contradizem de propósito.**
//
//  É o ponto inteiro da feature: hoje essas quatro regras vivem replicadas no cliente, e duas
//  implementações da mesma pergunta terminam mostrando dois totais diferentes na mesma tela.
//
//      quanto entrou     ->  filtra Kind <> 'transfer'   (senão o mesmo dinheiro conta de novo
//                                                         a cada vez que muda de conta)
//      quanto gastou     ->  soma PERNAS, nunca o TotalValue da compra
//      saldo da conta    ->  IGNORA o pendente           (mora no AccountBalance)
//      Spent do orçamento->  CONTA o pendente junto com o pago
//
//  As duas primeiras moram aqui; as duas últimas já moram nas suas sections e são chamadas,
//  não reescritas.
//
//  **A base de data é a competência**, não o caixa: este arquivo responde "quanto pesa no mês",
//  e é o `AccountBalance` que responde "quanto saiu". A separação existe em coluna desde o
//  `CompetenceMode` — ver ExpensePayments.CompetenceDate × CashDate.
//
//  **Os totais do mês contam pendente junto com pago, dos dois lados.** O indicador é de
//  planejamento: contar entrada só quando recebida e gasto já quando lançado o deixaria
//  pessimista dos dois lados. Só o cancelado sai.
class Controller {

    /**
     * @param ReferenceMonth primeiro dia do mês pedido — limite inclusivo
     * @param NextMonth primeiro dia do mês seguinte — limite exclusivo, corte meio aberto
     */
    public async run(IdWorkspace: number, ReferenceMonth: string, NextMonth: string) {
        let [Inflows, Expenses, OverdueReceivable, OverduePayable, OpenInvoices] = await Promise.all([
            this.sumInflows(IdWorkspace, ReferenceMonth, NextMonth),
            this.sumExpenses(IdWorkspace, ReferenceMonth, NextMonth),
            this.sumOverdueReceivable(IdWorkspace, ReferenceMonth),
            this.sumOverduePayable(IdWorkspace, ReferenceMonth),
            this.sumOpenInvoices(IdWorkspace, NextMonth),
        ])

        return { Inflows, Expenses, OverdueReceivable, OverduePayable, OpenInvoices }
    }

    //  **Quanto entrou no mês — e aqui a transferência NÃO conta.** É a regra oposta à do
    //  saldo da conta, que soma as duas pontas: mover 500 da corrente para a poupança não é
    //  patrimônio novo, e sem este filtro o mesmo dinheiro entraria de novo a cada movimento.
    private sumInflows(IdWorkspace: number, ReferenceMonth: string, NextMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .where("IdWorkspace", IdWorkspace)
            .whereNot("Kind", "transfer")
            .whereNot("Status", "canceled")
            .where("CompetenceDate", ">=", ReferenceMonth)
            .where("CompetenceDate", "<", NextMonth))
    }

    //  **A perna, nunca o TotalValue da compra.** É o que faz o indicador funcionar com
    //  parcelamento: 600 em 6x pesam 100 neste mês, e os outros 500 são problema dos próximos.
    private sumExpenses(IdWorkspace: number, ReferenceMonth: string, NextMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.CompetenceDate", ">=", ReferenceMonth)
            .where("ExpensePayments.CompetenceDate", "<", NextMonth))
    }

    /**
     * **O atrasado, que sem isto sumiria do indicador.**
     *
     * Uma entrada com competência em julho e nunca recebida não está no saldo de julho (não foi
     * recebida) nem na janela de agosto (a competência é de julho): ela **some** — e some
     * justamente o compromisso que ninguém honrou. O mesmo vale para a perna vencida do outro
     * lado, e é a simetria que impede o indicador de ficar pessimista de um lado só.
     *
     * **O custo está aceito de olhos abertos:** uma entrada prevista que nunca chega infla o
     * "posso gastar" para sempre. É por isso que os dois vão **expostos à parte** na resposta —
     * a tela mostra "R$ X vencidos", o usuário recebe ou cancela o que ficou para trás, e o
     * erro para de crescer calado em vez de virar uma correção automática que o servidor faz
     * sem contar a ninguém.
     */
    private sumOverdueReceivable(IdWorkspace: number, ReferenceMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "TotalValue" })
            .from("Inflows")
            .where("IdWorkspace", IdWorkspace)
            .whereNot("Kind", "transfer")
            .where("Status", "pending")
            .where("CompetenceDate", "<", ReferenceMonth))
    }

    private sumOverduePayable(IdWorkspace: number, ReferenceMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.Paid", false)
            .where("ExpensePayments.CompetenceDate", "<", ReferenceMonth))
    }

    /**
     * **O número que liga os dois indicadores: quanto do saldo já tem dono.**
     *
     * O buraco que o "posso gastar" mostra hoje é o que o "tenho em conta" vai mostrar quando a
     * fatura for paga. Sai da mesma consulta e fecha a conta para quem olha a tela: o saldo é
     * 4300, mas 500 dele já estão comprometidos com a fatura que vence este mês.
     *
     * **Corta pela `CashDate`**, e não pela competência, porque a pergunta é de caixa: o que
     * ainda vai sair da conta até o fim do mês pedido. Parcela de fevereiro não é dono do saldo
     * de setembro.
     *
     * **`Charged` não nulo é o que diz que a perna é de cartão** — a mesma nulidade que
     * `ClosingDate` e `DueDate` têm, e que evita reler a forma de pagamento (que pode ter sido
     * arquivada nesse meio-tempo). Fora do cartão não há fatura em aberto: o pix pendente é
     * dívida, não dinheiro já reservado.
     *
     * E **não há dupla contagem com o saldo**: pagar a fatura não cria lançamento nenhum, só
     * vira o `Paid` de pernas que já existem. A compra de agosto contada em agosto não volta a
     * contar em setembro.
     */
    private sumOpenInvoices(IdWorkspace: number, NextMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .whereNotNull("ExpensePayments.Charged")
            .where("ExpensePayments.Paid", false)
            .where("ExpensePayments.CashDate", "<", NextMonth))
    }

    //  O sum() do Postgres devolve null quando não há linha nenhuma, e null propaga por toda a
    //  fórmula transformando o indicador inteiro em null. O zero é a resposta certa: o mês sem
    //  gasto gastou zero.
    private async total(query: unknown) {
        let [row] = await (query as Promise<Array<{ Total: number | null }>>)

        return Number(row?.Total ?? 0)
    }
}

export const MonthTotals = new Controller()
