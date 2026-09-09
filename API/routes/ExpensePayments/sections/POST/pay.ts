import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { ExpenseStatus } from "root/routes/Expenses/sections/ExpenseStatus.section"
import { Expenses_model } from "root/routes/Expenses/Expenses.model"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { class_ExpensePayments_model, ExpensePayments_model } from "../../ExpensePayments.model"

//  Quita (ou desquita) **uma perna**. É a operação que move saldo: a leitura de saldo só soma
//  perna paga, então é este clique que tira o dinheiro da conta.
//
//  Por perna, e não por gasto, porque a compra em 6x precisa saber qual parcela já foi. Esse
//  detalhe **nunca** vira status parcial no gasto: quem resume é o ExpenseStatus, e ele só diz
//  'paid' quando todas as pernas estão pagas.
//
//  **Não vale para o cartão de crédito.** Lá o Paid significa "a fatura que contém esta perna
//  foi paga", e quem escreve isso é o payInvoice. Um botão de quitar numa linha de cartão modela
//  uma operação que não existe no mundo — não se paga uma compra isolada da fatura —, e era por
//  existir que ele deixava o saldo errado. Parcelado **fora** do cartão (carnê, crediário, o
//  racha com um amigo) continua sendo quitado parcela a parcela por aqui.
export class Pay {
    public async run(SelectedIdWorkspace: number, IdExpensePayment: number, IdUser: number, Paid: boolean) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let payment = await ExpensePayments_model.getUnique(IdWorkspace, IdExpensePayment)

        if (!payment) {
            throw new APIError({
                msg: "Pagamento não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpensePayment },
            })
        }

        //  `Charged` nulo é a marca de "não é perna de cartão", gravada no lançamento — ler a
        //  própria perna, e não a forma de pagamento, também sobrevive ao cartão arquivado.
        if (payment.Charged !== null) {
            throw new APIError({
                msg: "Perna de cartão de crédito é quitada com a fatura: use POST /PaymentMethods/IdPaymentMethod=:Id/payInvoice.",
                status: 406,
                data: { IdExpensePayment, IdPaymentMethod: payment.IdPaymentMethod },
            })
        }

        //  A perna não sabe do Status do gasto: quem sabe é o gasto. Quitar parcela de compra
        //  cancelada faria o saldo sair de uma compra que não existe mais.
        let expense = await Expenses_model.getUnique(IdWorkspace, payment.IdExpense)

        if (expense?.Status === "canceled") {
            throw new APIError({
                msg: "Gasto cancelado não tem parcela para quitar.",
                status: 406,
                data: { IdExpensePayment, IdExpense: payment.IdExpense },
            })
        }

        if (payment.Paid === Paid) {
            throw new APIError({
                msg: Paid ? "Esta parcela já está quitada." : "Esta parcela não está quitada.",
                status: 406,
                data: { IdExpensePayment },
            })
        }

        await KnexTransaction(async (tx) => {
            await new class_ExpensePayments_model(tx).pay(IdExpensePayment, Paid)

            //  Na mesma transaction: o Status derivado não pode ficar um instante em desacordo
            //  com as pernas de onde ele sai.
            await ExpenseStatus.refresh(IdWorkspace, payment.IdExpense, tx)
        })

        return { msg: Paid ? "Parcela quitada com sucesso" : "Parcela desquitada com sucesso" }
    }
}
