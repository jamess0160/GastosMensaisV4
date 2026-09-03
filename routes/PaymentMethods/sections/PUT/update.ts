import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { PaymentMethods_model } from "../../PaymentMethods.model"
import { PaymentMethodKind } from "../PaymentMethodKind.section"
import { PaymentMethodsNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdPaymentMethod: number, IdUser: number, body: PaymentMethodsNamespace.UpdatePaymentMethodPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let paymentMethod = await PaymentMethods_model.getUnique(IdWorkspace, IdPaymentMethod)

        if (!paymentMethod) {
            throw new APIError({
                msg: "Forma de pagamento não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPaymentMethod },
            })
        }

        //  O Kind que manda é o da linha gravada, não o do body — o schema nem aceita Kind,
        //  porque trocá-lo mudaria a regra de fatura de todas as compras já lançadas nesta
        //  forma de pagamento. Só aqui dá para saber se DueDay/ClosingOffsetDays cabem.
        PaymentMethodKind.assertKindFields(paymentMethod.Kind, body)

        //  A conta não muda: mover um cartão de conta moveria junto o saldo de todas as
        //  compras dele. Para isso, arquiva e cadastra de novo na conta certa.
        await PaymentMethods_model.update(IdPaymentMethod, body)

        return { msg: "Forma de pagamento atualizada com sucesso" }
    }
}
