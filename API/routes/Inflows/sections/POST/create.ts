import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { InflowKind } from "../InflowKind.section"
import { InflowsNamespace } from "../types"
import { CreateOne } from "./createOne"

//  Cria a entrada **ou** a transferência numa transaction só.
//
//  Aqui ficam a autorização e a conferência; a escrita mesma é a CreateOne, que recebe a
//  transaction e por isso serve tanto a esta rota quanto ao lote (POST /Inflows/batch).
//
//  **Pode nascer recebida**, e é o `Received` do corpo que diz — um booleano, nunca um
//  `Status`. O caso comum é lançar a renda **depois** de ela cair na conta, e exigir o
//  POST .../receive em seguida cobrava dois gestos por um fato só. A rota do recebimento
//  continua existindo e continua sendo o único caminho da entrada que **já** existe: é ela que
//  sabe recusar a cancelada, a já recebida, e desfazer.
//
//  O risco é real e é aceito: o saldo é calculado dos lançamentos, então uma entrada marcada
//  como recebida por engano aparece no extrato na hora. É o mesmo risco que a perna de gasto já
//  aceita com o `Paid` na criação — "o gasto no débito costuma já estar pago no ato" —, e é o
//  mesmo saldo nos dois casos: proibir só deste lado não protegia nada, só cobrava o clique. O
//  que o booleano continua não deixando passar é 'canceled' no nascimento, que não é lançamento
//  nenhum.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: InflowsNamespace.CreateInflowPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  As contas são deste workspace, e as regras do Kind fecham: a conferência antes de
        //  abrir a transaction, para o caminho de erro não segurar conexão à toa.
        await InflowKind.assertAccounts(IdWorkspace, body)

        return await KnexTransaction(async (tx) => {
            let IdInflow = await new CreateOne(tx).run(IdWorkspace, IdUser, body)

            return { IdInflow }
        })
    }
}
