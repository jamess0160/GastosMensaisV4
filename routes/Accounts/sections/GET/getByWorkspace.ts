import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Accounts_model } from "../../Accounts.model"

//  As contas do workspace, cada uma com as suas formas de pagamento embutidas. Vem junto
//  porque é sempre junto que o cliente usa: a tela de lançar gasto precisa da conta para
//  agrupar e da forma de pagamento para escolher, e separar viraria um GET por conta.
export class GetByWorkspace {
    //  SelectedIdWorkspace é o valor que veio do token da sessão. O IdWorkspace usado na consulta
    //  é o que volta da matrícula: veio do banco e está conferido.
    public async run(SelectedIdWorkspace: number, IdUser: number) {
        //  O token é assinado, mas foi emitido no login e vale 24h: a matrícula pode ter caído
        //  trivial. Sem esta conferência, isso viraria a lista de contas do vizinho.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Accounts_model.getByWorkspace(IdWorkspace).joinTables({
            PaymentMethods: {
                selfPath: "IdAccount",
                //  O joinTables não aplica filtro nenhum por conta própria: sem este append a
                //  conta traria de volta o cartão que o usuário arquivou.
                append: (query) => query.where("Active", true).orderBy("Position").orderBy("IdPaymentMethod"),
            },
        })
    }
}
