import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Inflows_model } from "../../Inflows.model"
import { InflowsNamespace } from "../types"

//  A lista do período. Sem o rateio embutido: quem precisa dele abre a entrada
//  (GET /Base/Inflows/IdInflow=:IdInflow), e trazer N rateios para desenhar uma lista de mês
//  seria carregar o que a tela não mostra.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number, filters: InflowsNamespace.ListFilters) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Inflows_model.getByWorkspace(IdWorkspace, filters)
    }
}
