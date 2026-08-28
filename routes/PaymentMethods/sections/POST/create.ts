import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Accounts_model } from "root/routes/Accounts/Accounts.model"
import { PaymentMethods_model } from "../../PaymentMethods.model"
import { PaymentMethodKind } from "../PaymentMethodKind.section"
import { PaymentMethodsNamespace } from "../types"

//  Cadastra um cartão de crédito. Pix e débito não passam por aqui: eles nascem com a conta
//  (createDefaults.ts), e deixar o cliente criar um segundo "pix" da mesma conta duplicaria
//  a forma de pagamento que o resto do modelo trata como única.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: PaymentMethodsNamespace.CreatePaymentMethodPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  O IdAccount chega pelo body e é sequencial: sem esta leitura escopada dava para
        //  pendurar um cartão na conta de outro tenant e enxergar os gastos dela depois.
        let account = await Accounts_model.getUnique(IdWorkspace, body.IdAccount)

        if (!account) {
            throw new APIError({
                msg: "Conta não encontrada!",
                status: 406,
                data: { IdWorkspace, IdAccount: body.IdAccount },
            })
        }

        //  Segunda barreira depois do `when` do Joi: a regra do fechamento/vencimento é a
        //  mesma nas duas escritas e mora numa section só.
        PaymentMethodKind.assertKindFields(body.Kind, body)

        let IdPaymentMethod = await PaymentMethods_model.create({ ...body, IdWorkspace }).returnId("IdPaymentMethod")

        return { IdPaymentMethod }
    }
}
