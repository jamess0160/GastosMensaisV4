import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { class_Accounts_model } from "../../Accounts.model"
import { CreateDefaults } from "root/routes/PaymentMethods/sections/POST/createDefaults"
import { AccountsNamespace } from "../types"

//  Cria a conta e, na mesma transaction, as formas de pagamento que nascem com ela.
//
//  Mesma forma do cadastro de usuário com o workspace: PaymentMethods é o único lugar onde
//  forma de pagamento existe, então uma conta sem nenhuma linha lá é uma conta em que não dá
//  para lançar nada — meia conta. As duas escritas caem ou passam juntas.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: AccountsNamespace.CreateAccountPayload) {
        //  Viewer lê o workspace, não cadastra dentro dele. O IdWorkspace escrito nas duas
        //  tabelas é o que volta da matrícula, não o que veio do token.
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        return await KnexTransaction(async (tx) => {
            let Accounts_model = new class_Accounts_model(tx)

            //  IdUser é o autor do cadastro; o dono do dado é o workspace.
            let IdAccount = await Accounts_model.create({ ...body, IdWorkspace, IdUser }).returnId("IdAccount")

            await new CreateDefaults(tx).run(IdWorkspace, IdAccount, body.Name)

            return { IdAccount }
        })
    }
}
