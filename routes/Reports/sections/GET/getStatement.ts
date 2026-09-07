import { Accounts_model } from "root/routes/Accounts/Accounts.model"
import { AccountBalance } from "root/routes/Accounts/sections/AccountBalance.section"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Utils } from "root/Utils/Utils"
import { StatementEntries } from "../StatementEntries.section"

//  **O extrato de cada conta e de cada cartão, numa rota só** — não uma por conta: a tela é
//  uma, e uma requisição por conta multiplicaria ida e volta para montar tela nenhuma a mais.
//
//  **Ele é a decomposição do saldo, não uma consulta nova.** A demanda é literalmente essa: o
//  saldo no início do mês, menos o que saiu, tem que dar o saldo que a tela já mostra em outro
//  lugar. Por isso o `ClosingBalance` **continua vindo do `AccountBalance`**, nunca de somar as
//  linhas — uma segunda implementação da mesma pergunta é como as duas telas passam a
//  discordar. O que garante que elas concordam não é boa vontade: é o teste da etapa, que soma
//  as linhas em centavos e compara com o saldo.
//
//  O `OpeningBalance` é o mesmo termo de `GET /Reports/Month`, e sai do mesmo lugar: o
//  `AccountBalance` chamado com o primeiro dia do mês pedido, já que o corte é meio aberto.
//
//  **`ReferenceMonth`, e não `From`/`To`** como as listagens de movimento: aqui o mês é a
//  unidade porque as duas pontas são *posições* — um extrato de 15 de agosto a 3 de setembro
//  não tem saldo de abertura que signifique alguma coisa.
export class GetStatement {

    public async run(SelectedIdWorkspace: number, IdUser: number, ReferenceMonth?: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let month = Utils.monthStart(ReferenceMonth ?? Utils.currentMonth())
        let nextMonth = Utils.addMonthsToDate(month, 1)

        //  **Com as arquivadas**: `Active = false` quer dizer "não use mais", não "não
        //  existiu", e o mês em que a conta ainda tinha movimento tem que ser consultável. O
        //  mesmo vale para o cartão arquivado, exatamente como o saldo já faz ao não filtrar
        //  Active nas formas de pagamento.
        let accounts = await Accounts_model.getAllByWorkspace(IdWorkspace)

        let [opening, closing, entries, Cards] = await Promise.all([
            AccountBalance.getByAccounts(accounts, month),
            AccountBalance.getByAccounts(accounts, nextMonth),
            StatementEntries.getByAccounts(IdWorkspace, accounts, month, nextMonth),
            StatementEntries.getByCards(IdWorkspace, month, nextMonth),
        ])

        return {
            ReferenceMonth: month,
            Accounts: accounts
                //  A conta arquivada só aparece no mês em que ainda teve movimento — senão a
                //  lista do extrato encheria de contas mortas que não têm nada a mostrar. A
                //  ativa aparece sempre, mesmo vazia: ela é uma linha da tela.
                .filter((account) => account.Active || entries.get(account.IdAccount)!.length)
                .map((account) => ({
                    IdAccount: account.IdAccount,
                    Name: account.Name,
                    Active: account.Active,
                    OpeningBalance: opening.get(account.IdAccount) ?? 0,
                    ClosingBalance: closing.get(account.IdAccount) ?? 0,
                    Entries: entries.get(account.IdAccount)!,
                })),
            Cards,
        }
    }
}
