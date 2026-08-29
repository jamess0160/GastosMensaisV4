import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { class_Expenses_model } from "../../Expenses.model"
import { ExpenseSeries } from "../ExpenseSeries.section"

//  Encerra a série fixa **da ocorrência escolhida para a frente**.
//
//  Cancelar a assinatura em outubro não apaga o que foi pago de janeiro a setembro: as
//  ocorrências anteriores continuam lá, com o valor que valeu. As de outubro em diante são
//  canceladas, e a raiz passa a registrar até quando a série existiu.
export class RemoveSeries {
    public async run(SelectedIdWorkspace: number, IdExpense: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let { forward, past, IdRootExpense } = await ExpenseSeries.resolve(IdWorkspace, IdExpense)

        if (!forward.length) {
            throw new APIError({
                msg: "Esta série já está encerrada a partir desta ocorrência.",
                status: 406,
                data: { IdExpense },
            })
        }

        //  O fim da série é a última ocorrência que sobrou. Cancelando desde a raiz não sobra
        //  nenhuma, e aí a série morre no dia em que nasceu.
        let RecurrenceEndDate = past.length
            ? past[past.length - 1].ExpenseDate
            : forward[0].ExpenseDate

        await KnexTransaction(async (tx) => {
            let Expenses_model = new class_Expenses_model(tx)

            await Expenses_model.updateMany(forward.map((item) => item.IdExpense), { Status: "canceled" })

            //  A recorrência vive na raiz, mesmo quando ela própria foi cancelada agora: é a
            //  linha que responde "esta série existiu de quando até quando".
            await Expenses_model.update(IdRootExpense, { RecurrenceEndDate })
        })

        return { msg: "Série encerrada com sucesso", Canceled: forward.length }
    }
}
