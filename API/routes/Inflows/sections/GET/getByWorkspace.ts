import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Inflows_model } from "../../Inflows.model"
import { InflowsNamespace } from "../types"

//  A lista do período, e desde a leva 10 ela traz a entrada INTEIRA: sem o rateio entre pessoas,
//  não há mais nada que só o GET por id saiba. É o que tirou da tela de Renda uma requisição
//  por linha do mês.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number, filters: InflowsNamespace.ListFilters) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Inflows_model.getByWorkspace(IdWorkspace, filters)
    }
}
