import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { PaymentMethods_model } from "../../PaymentMethods.model"

//  Arquiva a forma de pagamento (Active = false).
//
//  Não é delete físico: ExpensePayments aponta para cá com ON DELETE RESTRICT, e o banco
//  recusaria apagar um cartão com compra lançada — o que é o comportamento certo, porque a
//  perna do gasto tem que continuar sabendo em que cartão a compra foi feita. Arquivar tira
//  o cartão das listas de escolha sem tocar no histórico.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdPaymentMethod: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let paymentMethod = await PaymentMethods_model.getUnique(IdWorkspace, IdPaymentMethod)

        if (!paymentMethod) {
            throw new APIError({
                msg: "Forma de pagamento não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPaymentMethod },
            })
        }

        await PaymentMethods_model.delete(IdPaymentMethod)

        return { msg: "Forma de pagamento arquivada com sucesso" }
    }
}
