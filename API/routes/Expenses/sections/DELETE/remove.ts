import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Expenses_model } from "../../Expenses.model"

//  Cancela **um** gasto (Status = 'canceled'). Não há Active nesta tabela nem delete físico: as
//  pernas apontam para PaymentMethods com ON DELETE RESTRICT, e o histórico precisa continuar
//  explicando o que houve.
//
//  Numa compra parcelada isto cancela a compra inteira — as 6 parcelas são pernas de uma linha
//  só, então não há como cancelar meia compra. Numa série fixa cancela só esta ocorrência; para
//  encerrar a série há a rota /series.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdExpense: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let expense = await Expenses_model.getUnique(IdWorkspace, IdExpense)

        if (!expense) {
            throw new APIError({
                msg: "Gasto não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpense },
            })
        }

        if (expense.Status === "canceled") {
            throw new APIError({
                msg: "Este gasto já está cancelado.",
                status: 406,
                data: { IdExpense },
            })
        }

        //  Sem mexer nas pernas: o Paid delas é fato histórico e continua gravado. O que tira o
        //  dinheiro de volta é o saldo ignorar as pernas de gasto cancelado (ver
        //  Accounts/sections/AccountBalance.section.ts) — cancelar é o estorno, e não precisa
        //  desfazer escrita nenhuma porque nada foi guardado.
        await Expenses_model.update(IdExpense, { Status: "canceled" })

        return { msg: "Gasto cancelado com sucesso" }
    }
}
