import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"

//  'pending' -> 'received'. É esta rota que move o saldo da conta — não porque escreva saldo
//  em lugar nenhum (não existe coluna), mas porque o cálculo só soma o que está recebido.
//
//  Tudo ou nada: não há 'partial' nem coluna ReceivedValue. Uma entrada que caiu pela metade é
//  duas entradas.
export class Receive {
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

        //  Receber de novo reescreveria o ReceivedAt de um dinheiro que já caiu — a data em que
        //  ele entrou é informação, não detalhe. Já cancelada não volta por aqui.
        if (inflow.Status !== "pending") {
            throw new APIError({
                msg: inflow.Status === "received"
                    ? "Esta entrada já foi recebida."
                    : "Entrada cancelada não pode ser recebida.",
                status: 406,
                data: { IdInflow, Status: inflow.Status },
            })
        }

        await Inflows_model.receive(IdInflow)

        return { msg: "Entrada recebida com sucesso" }
    }
}
