import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"

//  Cancela a entrada (Status = 'canceled'). Não há Active nesta tabela: o cancelamento é o
//  estado terminal, e a linha fica — Inflows aponta para Accounts com ON DELETE RESTRICT nas
//  duas pontas, e o extrato precisa continuar explicando o que houve.
//
//  Cancelar uma entrada já recebida é permitido e é o estorno: como o saldo é calculado dos
//  lançamentos, a linha sai da soma na próxima leitura, sem nada para reverter à mão.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdInflow: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let inflow = await Inflows_model.getUnique(IdWorkspace, IdInflow)

        if (!inflow) {
            throw new APIError({
                msg: "Entrada não encontrada!",
                status: 406,
                data: { IdWorkspace, IdInflow },
            })
        }

        if (inflow.Status === "canceled") {
            throw new APIError({
                msg: "Esta entrada já está cancelada.",
                status: 406,
                data: { IdInflow },
            })
        }

        await Inflows_model.cancel(IdInflow)

        return { msg: "Entrada cancelada com sucesso" }
    }
}
