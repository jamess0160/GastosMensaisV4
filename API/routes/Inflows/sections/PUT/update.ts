import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"
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
        //  dos fundos, sem passar por conferência nenhuma.
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
        //
        //  Uma escrita só, e por isso sem KnexTransaction: o rateio era o segundo write daqui,
        //  e a transaction existia para os dois caírem juntos.
        await Inflows_model.update(IdInflow, body)

        return { msg: "Entrada atualizada com sucesso" }
    }
}
