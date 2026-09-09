import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { class_Accounts_model, Accounts_model } from "../../Accounts.model"
import { class_PaymentMethods_model } from "root/routes/PaymentMethods/PaymentMethods.model"

//  Arquiva a conta (Active = false) e, junto, as formas de pagamento dela.
//
//  Não é delete físico: Inflows aponta para Accounts nas duas pontas e ExpensePayments aponta
//  para PaymentMethods, os três com ON DELETE RESTRICT. O banco recusaria — e está certo, o
//  histórico precisa continuar apontando para a conta que foi de fato usada.
//
//  As filhas vão na mesma transaction porque um pix que sobrevive à conta arquivada continua
//  aparecendo como opção de pagamento de uma conta que sumiu da lista.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdAccount: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let account = await Accounts_model.getUnique(IdWorkspace, IdAccount)

        if (!account) {
            throw new APIError({
                msg: "Conta não encontrada!",
                status: 406,
                data: { IdWorkspace, IdAccount },
            })
        }

        await KnexTransaction(async (tx) => {
            await new class_PaymentMethods_model(tx).deleteByAccount(IdAccount)
            await new class_Accounts_model(tx).delete(IdAccount)
        })

        return { msg: "Conta arquivada com sucesso" }
    }
}
