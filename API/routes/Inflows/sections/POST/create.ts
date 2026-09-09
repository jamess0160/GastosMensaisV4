import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { InflowKind } from "../InflowKind.section"
import { InflowSplit } from "../InflowSplit.section"
import { InflowsNamespace } from "../types"
import { CreateOne } from "./createOne"

//  Cria a entrada **ou** a transferência, com o rateio, numa transaction só.
//
//  Aqui ficam a autorização e as conferências; a escrita mesma é a CreateOne, que recebe a
//  transaction e por isso serve tanto a esta rota quanto ao lote (POST /Inflows/batch).
//
//  Nasce sempre 'pending': receber é uma ação à parte (POST .../receive), porque é o
//  recebimento que move o saldo. Lançar já recebido seria misturar as duas coisas — e o saldo
//  é calculado dos lançamentos, então uma entrada marcada como recebida por engano aparece
//  imediatamente no extrato.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: InflowsNamespace.CreateInflowPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  As contas são deste workspace, e as regras do Kind fecham: as duas conferências
        //  antes de abrir a transaction, para o caminho de erro não segurar conexão à toa.
        await InflowKind.assertAccounts(IdWorkspace, body)
        await InflowSplit.assertSplit(IdWorkspace, body.Kind, body.TotalValue, body.Persons)

        return await KnexTransaction(async (tx) => {
            let IdInflow = await new CreateOne(tx).run(IdWorkspace, IdUser, body)

            return { IdInflow }
        })
    }
}
