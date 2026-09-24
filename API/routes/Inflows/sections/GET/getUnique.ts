import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"

//  A entrada, e nada além do que a lista já traz — desde que o rateio saiu, esta rota devolve a
//  mesma `inflowResponse`. Ela continua existindo por dois motivos: a cancelada sai por aqui, ao
//  contrário da lista (quem tem o id na mão está abrindo uma linha específica, e esconder o que
//  foi cancelado só deixaria a tela dizer "não encontrada" para algo que existe), e é ela que o
//  cliente relê antes de editar, em vez de salvar em cima de uma versão velha do cache.
export class GetUnique {
    public async run(SelectedIdWorkspace: number, IdInflow: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let inflow = await Inflows_model.getUnique(IdWorkspace, IdInflow)

        if (!inflow) {
            throw new APIError({
                msg: "Entrada não encontrada!",
                status: 406,
                data: { IdWorkspace, IdInflow },
            })
        }

        return inflow
    }
}
