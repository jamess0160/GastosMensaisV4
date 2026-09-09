import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { class_ExpensePayments_model, ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { ExpenseStatus } from "root/routes/Expenses/sections/ExpenseStatus.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { PaymentMethods_model } from "../../PaymentMethods.model"

//  **Quita (ou desquita) a fatura inteira.** É o que faltava para o saldo do cartão descer.
//
//  Antes disso só existia o `pay` de uma perna por vez, e uma fatura de cartão concentrador tem
//  40 compras: ninguém marca 40, então as pernas ficavam `pending` para sempre e o saldo subia
//  mês a mês enquanto a conta real caía. Este é o `pay` em lote, com a mesma mecânica.
//
//  **A fatura já existe nos dados; faltava só a rota.** Todas as pernas de um mesmo ciclo
//  compartilham o mesmo `DueDate` exato — o InvoiceDates calcula o vencimento a partir do
//  `DueDay` do cartão, então duas compras do mesmo ciclo caem no mesmo dia do mesmo mês. Uma
//  fatura é `(IdPaymentMethod, DueDate)`: uma consulta, não um cadastro. **Nenhuma tabela nova.**
export class PayInvoice {
    public async run(SelectedIdWorkspace: number, IdPaymentMethod: number, IdUser: number, DueDate: string, Paid: boolean) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  O id chega do cliente e é sequencial: sem esta leitura escopada daria para quitar a
        //  fatura do vizinho e mexer no saldo dele.
        let method = await PaymentMethods_model.getUnique(IdWorkspace, IdPaymentMethod)

        if (!method) {
            throw new APIError({
                msg: "Forma de pagamento não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPaymentMethod },
            })
        }

        if (method.Kind !== "credit_card") {
            throw new APIError({
                msg: "Só cartão de crédito tem fatura: fora dele, quite a linha.",
                status: 406,
                data: { IdPaymentMethod, Kind: method.Kind },
            })
        }

        let legs = await ExpensePayments_model.getByInvoice(IdWorkspace, IdPaymentMethod, DueDate)

        //  **Fatura sem perna nenhuma não é fatura paga, é fatura que não existe.** Mesmo
        //  cuidado que o ExpenseStatus já tem com o `every` sobre lista vazia, e pela mesma
        //  razão: sem esta guarda, quitar um vencimento inventado responderia sucesso.
        if (!legs.length) {
            throw new APIError({
                msg: "Não há fatura com este vencimento neste cartão.",
                status: 406,
                data: { IdPaymentMethod, DueDate },
            })
        }

        //  **Pernas que já estão no estado pedido são puladas**, e é isso que torna repetir a
        //  chamada inofensivo. Resolve o caso real: lançar hoje uma compra esquecida que
        //  pertence a uma fatura já paga e chamar de novo — quita só a que faltava.
        let pending = legs.filter((leg) => leg.Paid !== Paid)

        if (pending.length) {
            await KnexTransaction(async (tx) => {
                await new class_ExpensePayments_model(tx).payMany(pending.map((leg) => leg.IdExpensePayment), Paid)

                //  Na mesma transaction, o Status derivado de **cada gasto atingido**: 40 pernas
                //  podem ser 40 gastos diferentes, e cada um tem que ser recalculado na mesma
                //  janela em que as pernas mudaram.
                for (let IdExpense of new Set(pending.map((leg) => leg.IdExpense))) {
                    await ExpenseStatus.refresh(IdWorkspace, IdExpense, tx)
                }
            })
        }

        return {
            msg: Paid ? "Fatura quitada com sucesso" : "Fatura desquitada com sucesso",
            /** Quantas pernas mudaram de estado. Zero é resposta legítima: a fatura já estava assim. */
            Payments: pending.length,
        }
    }
}
