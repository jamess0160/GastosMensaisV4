import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Expenses_model } from "root/routes/Expenses/Expenses.model"
import { APIError } from "root/Utils/Logs"
import { ExpensePayments_model } from "../../ExpensePayments.model"

//  Marca (ou desmarca) que **a cobrança entrou na fatura**. Só no cartão.
//
//  **Não move saldo nenhum.** É a conferência de assinatura — "a Netflix cobrou mesmo este mês?
//  veio no valor certo?" —, e a resposta é do usuário olhando o app do cartão. Quem tira dinheiro
//  da conta é o pagamento da fatura (PaymentMethods/.../payInvoice), semanas depois.
//
//  É afirmação, nunca palpite. Seria tentador derivar de "a data já passou", mas a lista é
//  olhada justamente para achar onde a realidade discordou da previsão — a assinatura que não
//  cobrou, que cobrou dobrado, que mudou de dia. Uma marcação derivada da data nunca discorda de
//  nada, então nunca acha nada.
export class Charge {
    public async run(SelectedIdWorkspace: number, IdExpensePayment: number, IdUser: number, Charged: boolean) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let payment = await ExpensePayments_model.getUnique(IdWorkspace, IdExpensePayment)

        if (!payment) {
            throw new APIError({
                msg: "Pagamento não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpensePayment },
            })
        }

        //  `Charged` nulo é a marca de "esta perna não é de cartão", gravada no lançamento pela
        //  mesma razão que ClosingDate e DueDate ficam nulas: não há fatura em que entrar. Ler a
        //  própria perna, e não a forma de pagamento, também sobrevive ao cartão arquivado.
        if (payment.Charged === null) {
            throw new APIError({
                msg: "Só compra no cartão de crédito entra em fatura.",
                status: 406,
                data: { IdExpensePayment, IdPaymentMethod: payment.IdPaymentMethod },
            })
        }

        //  A perna não sabe do Status do gasto: quem sabe é o gasto. Conferir a fatura de uma
        //  compra cancelada é conferir o que não existe mais.
        let expense = await Expenses_model.getUnique(IdWorkspace, payment.IdExpense)

        if (expense?.Status === "canceled") {
            throw new APIError({
                msg: "Gasto cancelado não entra em fatura.",
                status: 406,
                data: { IdExpensePayment, IdExpense: payment.IdExpense },
            })
        }

        if (payment.Charged === Charged) {
            throw new APIError({
                msg: Charged ? "Esta cobrança já está marcada como lançada na fatura." : "Esta cobrança não está marcada como lançada na fatura.",
                status: 406,
                data: { IdExpensePayment },
            })
        }

        //  Sem transaction e sem ExpenseStatus: o Charged não é fonte de derivado nenhum — o
        //  Status do gasto continua saindo só do Paid, e o saldo também.
        await ExpensePayments_model.charge(IdExpensePayment, Charged)

        return { msg: Charged ? "Cobrança marcada como lançada na fatura" : "Cobrança desmarcada da fatura" }
    }
}
