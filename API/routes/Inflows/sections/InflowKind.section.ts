import { Accounts_model } from "root/routes/Accounts/Accounts.model"
import { APIError } from "root/Utils/Logs"
import { InflowsNamespace } from "./types"

//  O Kind discrimina duas coisas diferentes na mesma tabela, e cada uma tem a sua regra de
//  contas:
//
//      'inflow'   -> o dinheiro veio de fora: IdToAccount obrigatório, IdFromAccount nulo
//      'transfer' -> entre contas próprias: as duas obrigatórias e diferentes entre si
//
//  Os dois CHECK do banco são a rede. Aqui é onde a recusa vira mensagem — e é o único lugar
//  que confere o que o banco não tem como conferir: que as contas são **deste** workspace.
class Controller {

    //  Devolve as contas conferidas. O id chega do cliente e é sequencial: sem esta leitura
    //  escopada dava para depositar numa conta de outro tenant e ler o saldo dela depois.
    public async assertAccounts(IdWorkspace: number, body: Pick<InflowsNamespace.CreateInflowPayload, "Kind" | "IdFromAccount" | "IdToAccount">) {

        if (body.Kind === "inflow" && body.IdFromAccount) {
            throw new APIError({
                msg: "Entrada não tem conta de origem: o dinheiro veio de fora. Para mover entre contas, use Kind='transfer'.",
                status: 406,
                data: { Kind: body.Kind, IdFromAccount: body.IdFromAccount },
            })
        }

        if (body.Kind === "transfer") {
            if (!body.IdFromAccount) {
                throw new APIError({
                    msg: "Transferência precisa da conta de origem.",
                    status: 406,
                    data: { Kind: body.Kind },
                })
            }

            //  O CHECK do banco também barra, mas com 500. E transferir de uma conta para ela
            //  mesma não é erro de digitação inofensivo: seria um lançamento que não move nada.
            if (body.IdFromAccount === body.IdToAccount) {
                throw new APIError({
                    msg: "A transferência precisa de duas contas diferentes.",
                    status: 406,
                    data: { IdAccount: body.IdToAccount },
                })
            }
        }

        let toAccount = await this.assertAccount(IdWorkspace, body.IdToAccount)
        let fromAccount = body.IdFromAccount ? await this.assertAccount(IdWorkspace, body.IdFromAccount) : null

        return { toAccount, fromAccount }
    }

    private async assertAccount(IdWorkspace: number, IdAccount: number) {
        let account = await Accounts_model.getUnique(IdWorkspace, IdAccount)

        //  Arquivada também cai aqui, porque o getUnique filtra Active: lançar numa conta
        //  arquivada é lançar numa conta que sumiu das listas de escolha.
        if (!account) {
            throw new APIError({
                msg: "Conta não encontrada!",
                status: 406,
                data: { IdWorkspace, IdAccount },
            })
        }

        return account
    }
}

export const InflowKind = new Controller()
