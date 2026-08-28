import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { Accounts_model } from "../../Accounts.model"
import { AccountMovement } from "../AccountMovement.section"
import { AccountsNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdAccount: number, IdUser: number, body: AccountsNamespace.UpdateAccountPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let account = await Accounts_model.getUnique(IdWorkspace, IdAccount)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdAccount existem nos outros tenants.
        if (!account) {
            throw new APIError({
                msg: "Conta não encontrada!",
                status: 406,
                data: { IdWorkspace, IdAccount },
            })
        }

        await this.assertOpeningBalanceIsFree(account, body)

        await Accounts_model.update(IdAccount, body)

        return { msg: "Conta atualizada com sucesso" }
    }

    //  O saldo de abertura é o chão de onde todo o resto é calculado — não há coluna de saldo
    //  atual, o saldo é sempre InitialBalance + lançamentos. Mudá-lo com lançamento já feito
    //  reescreve o saldo histórico por baixo: o extrato de março muda sozinho.
    //
    //  Entre travar e recalcular, trava: não há o que recalcular, porque nada foi guardado.
    //  Enquanto a conta está vazia é só correção de digitação e passa direto.
    private async assertOpeningBalanceIsFree(account: Database.Accounts, body: AccountsNamespace.UpdateAccountPayload) {

        let changed = (body.InitialBalance !== undefined && body.InitialBalance !== account.InitialBalance)
            || (body.InitialBalanceDate !== undefined && body.InitialBalanceDate !== account.InitialBalanceDate)

        //  Reenviar o mesmo valor não é troca: o cliente que devolve o objeto inteiro no PUT
        //  não pode ser barrado por isso.
        if (!changed) return

        if (await AccountMovement.hasMovement(account.IdAccount)) {
            throw new APIError({
                msg: "Esta conta já tem lançamentos: o saldo inicial não pode mais ser alterado.",
                status: 406,
                data: { IdAccount: account.IdAccount },
            })
        }
    }
}
