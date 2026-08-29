import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { class_Inflows_model, Inflows_model } from "../../Inflows.model"
import { class_InflowPersons_model, InflowPersons_model } from "../../InflowPersons.model"
import { InflowSplit } from "../InflowSplit.section"
import { InflowsNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdInflow: number, IdUser: number, body: InflowsNamespace.UpdateInflowPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let inflow = await Inflows_model.getUnique(IdWorkspace, IdInflow)

        if (!inflow) {
            throw new APIError({
                msg: "Entrada não encontrada!",
                status: 406,
                data: { IdWorkspace, IdInflow },
            })
        }

        //  Cancelada é estado terminal: editar o que foi cancelado seria ressuscitar pela porta
        //  dos fundos, sem passar por conferência nenhuma de conta ou de rateio.
        if (inflow.Status === "canceled") {
            throw new APIError({
                msg: "Entrada cancelada não pode ser editada.",
                status: 406,
                data: { IdInflow },
            })
        }

        //  Editar uma entrada **recebida** é permitido, e é justamente o que a decisão de não
        //  guardar saldo compra: não há cache para corrigir, o extrato é recalculado da linha
        //  na próxima leitura. É o oposto do InitialBalance da conta, que trava depois do
        //  primeiro lançamento — aquele é dado de origem, este é o próprio lançamento.
        //
        //  O Status não vem no corpo em hipótese nenhuma: quem o move são receive e cancel.
        let split = await this.resolveSplit(IdInflow, body)

        //  O invariante é conferido mesmo quando o rateio não mudou: se só o TotalValue mudou,
        //  é o rateio antigo que deixou de fechar.
        await InflowSplit.assertSplit(IdWorkspace, inflow.Kind, body.TotalValue, split)

        let { Persons, ...record } = body

        await KnexTransaction(async (tx) => {
            await new class_Inflows_model(tx).update(IdInflow, record)

            //  Sem Persons no corpo o rateio gravado fica como está — e como ele acabou de ser
            //  conferido contra o novo total, não há o que reescrever.
            if (!Persons) return

            //  Substituído inteiro, nunca remendado: é o que mantém a soma fechando.
            let InflowPersons_model = new class_InflowPersons_model(tx)

            await InflowPersons_model.deleteByInflow(IdInflow)

            if (Persons.length) {
                await InflowPersons_model.create(Persons.map((person) => ({ ...person, IdWorkspace, IdInflow })))
            }
        })

        return { msg: "Entrada atualizada com sucesso" }
    }

    //  O rateio que vale para a conferência: o do corpo quando ele veio, o gravado quando não.
    private async resolveSplit(IdInflow: number, body: InflowsNamespace.UpdateInflowPayload) {
        if (body.Persons) return body.Persons

        let stored = await InflowPersons_model.getByInflow(IdInflow)

        return stored.map((person) => ({ IdPerson: person.IdPerson, Value: person.Value }))
    }
}
