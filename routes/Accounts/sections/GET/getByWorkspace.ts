import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Utils } from "root/Utils/Utils"
import { Accounts_model } from "../../Accounts.model"
import { AccountBalance } from "../AccountBalance.section"

//  As contas do workspace, cada uma com as suas formas de pagamento embutidas. Vem junto
//  porque é sempre junto que o cliente usa: a tela de lançar gasto precisa da conta para
//  agrupar e da forma de pagamento para escolher, e separar viraria um GET por conta.
export class GetByWorkspace {
    //  SelectedIdWorkspace é o valor que veio do token da sessão. O IdWorkspace usado na consulta
    //  é o que volta da matrícula: veio do banco e está conferido.
    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth?: string) {
        //  O token é assinado, mas foi emitido no login e vale 24h: a matrícula pode ter caído
        //  trivial. Sem esta conferência, isso viraria a lista de contas do vizinho.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let accounts = await Accounts_model.getByWorkspace(IdWorkspace).joinTables({
            PaymentMethods: {
                selfPath: "IdAccount",
                //  O joinTables não aplica filtro nenhum por conta própria: sem este append a
                //  conta traria de volta o cartão que o usuário arquivou.
                append: (query) => query.where("Active", true).orderBy("Position").orderBy("IdPaymentMethod"),
            },
        })

        //  O saldo é sempre o saldo **de um mês**: sem corte, uma entrada de setembro já
        //  marcada como recebida entraria no saldo de agosto. Omitir o mês é pedir o corrente,
        //  que é o que a tela abre — o cliente só manda o parâmetro quando navega.
        let month = Utils.monthStart(ReferenceMonth ?? Utils.currentMonth())

        //  Limite exclusivo: "até o fim do mês" é "antes do dia 1 do seguinte".
        let nextMonth = Utils.addMonthsToDate(month, 1)

        //  O saldo não é coluna: é sempre calculado dos lançamentos, num lugar só. Vai junto
        //  com a conta porque não existe tela que mostre uma sem o outro.
        let balances = await AccountBalance.getByAccounts(accounts, nextMonth)

        //  O mapa vem com uma entrada por conta, inclusive as sem lançamento nenhum — o
        //  fallback aqui é só o tipo, não uma regra de saldo (a abertura já foi cortada lá).
        return accounts.map((account) => ({ ...account, Balance: balances.get(account.IdAccount) ?? 0 }))
    }
}
