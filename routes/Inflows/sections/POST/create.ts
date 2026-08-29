import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { class_Inflows_model } from "../../Inflows.model"
import { class_InflowPersons_model } from "../../InflowPersons.model"
import { InflowKind } from "../InflowKind.section"
import { InflowSplit } from "../InflowSplit.section"
import { InflowsNamespace } from "../types"

//  Cria a entrada **ou** a transferência, com o rateio, numa transaction só.
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

        let { Persons, ...inflow } = body

        return await KnexTransaction(async (tx) => {
            let IdInflow = await new class_Inflows_model(tx).create({
                ...inflow,
                IdWorkspace,
                //  Autoria do lançamento; o dono do dado é o workspace.
                IdUser,
                //  Em 'inflow' o dinheiro veio de fora: a coluna existe, mas fica nula.
                IdFromAccount: inflow.Kind === "transfer" ? inflow.IdFromAccount : null,
            }).returnId("IdInflow")

            if (Persons.length) {
                await new class_InflowPersons_model(tx).create(Persons.map((person) => ({ ...person, IdWorkspace, IdInflow })))
            }

            return { IdInflow }
        })
    }
}
