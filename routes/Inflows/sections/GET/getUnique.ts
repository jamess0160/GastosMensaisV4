import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"
import { InflowPersons_model } from "../../InflowPersons.model"

//  A entrada com o rateio. A cancelada também sai por aqui, ao contrário da lista: quem tem o
//  id na mão está abrindo uma linha específica, e esconder o que foi cancelado só deixaria a
//  tela dizer "não encontrada" para algo que existe.
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

        return { ...inflow, Persons: await InflowPersons_model.getByInflow(IdInflow) }
    }
}
