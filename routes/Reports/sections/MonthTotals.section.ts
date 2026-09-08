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
        let [Inflows, Expenses, PastCommitments, OverdueReceivable, OverduePayable, OpenInvoices] = await Promise.all([
            this.sumInflows(IdWorkspace, ReferenceMonth, NextMonth),
            this.sumExpenses(IdWorkspace, ReferenceMonth, NextMonth),
            this.sumPastCommitments(IdWorkspace, ReferenceMonth),
            this.sumOverdueReceivable(IdWorkspace, ReferenceMonth),
            this.sumOverduePayable(IdWorkspace, ReferenceMonth),
            this.sumOpenInvoices(IdWorkspace, NextMonth),
        ])

        return { Inflows, Expenses, PastCommitments, OverdueReceivable, OverduePayable, OpenInvoices }
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
     * **A ponte entre as duas bases de data, e sem ela a fórmula não fecha.**
     *
     * O `OpeningBalance` é **caixa** (o `AccountBalance` corta pela `CashDate`) e o fluxo do mês
     * é **competência**. Enquanto as duas datas coincidiam a soma fechava por acidente; o
     * `CompetenceMode` fez elas divergirem de propósito, e `purchase` é o default de todo
     * cartão — então a divergência é a regra, não a exceção.
     *
     * Estas são as pernas que **já pesaram num mês anterior mas cujo dinheiro ainda está na
     * conta**: a compra de 25/08 no cartão que vence em 28/09. Ela foi descontada do "posso
     * gastar" de agosto (é o que a competência faz), e o saldo de 31/08 ainda a contém (a fatura
     * não tinha vencido). Sem descontá-la aqui, setembro abre com um dinheiro que já tem dono.
     *
     * **Sem filtro de `Paid`, e é isso que conserta o pior sintoma.** Antes, a perna paga dentro
     * do mês pedido não estava em lugar nenhum — nem na abertura (a `CashDate` é depois do
     * corte), nem no `Expenses` (a competência é de antes), nem no vencido (estava paga). Ela
     * **sumia**, e quitar a fatura *aumentava* o quanto a pessoa podia gastar. Paga ou não, o
     * dinheiro está comprometido do mesmo jeito: o que decide é a data, nunca o estado.
     *
     * Com isto, cada perna é contada **exatamente uma vez**: competência no mês vai para o
     * `Expenses`; competência anterior se divide entre caixa anterior (paga → já está na
     * abertura; não paga → `OverduePayable`) e caixa daqui para a frente (→ aqui).
     */
    private sumPastCommitments(IdWorkspace: number, ReferenceMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.CompetenceDate", "<", ReferenceMonth)
            .where("ExpensePayments.CashDate", ">=", ReferenceMonth))
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

    /**
     * **Vencido é a perna cujo dinheiro já devia ter saído e não saiu** — as duas datas no
     * passado, não só a competência.
     *
     * O filtro pela `CashDate` é o que separa este número do `PastCommitments`, e sem ele os
     * dois se sobrepõem: a perna de competência anterior com vencimento à frente seria
     * subtraída duas vezes. Ele também conserta o rótulo, que estava errado desde que o
     * `CompetenceMode` existe — **toda** compra do mês passado no cartão caía aqui, e a tela
     * anunciava como "R$ X vencidos" uma fatura que vence semana que vem.
     */
    private sumOverduePayable(IdWorkspace: number, ReferenceMonth: string) {
        return this.total(KnexConnection
            .sum({ Total: "ExpensePayments.Value" })
            .from("ExpensePayments")
            .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
            .where("ExpensePayments.IdWorkspace", IdWorkspace)
            .whereNot("Expenses.Status", "canceled")
            .where("ExpensePayments.Paid", false)
            .where("ExpensePayments.CompetenceDate", "<", ReferenceMonth)
            .where("ExpensePayments.CashDate", "<", ReferenceMonth))
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
