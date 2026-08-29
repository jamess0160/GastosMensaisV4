import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Persons_model } from "../../Persons.model"

//  As pessoas do workspace, em ordem de nome: é a lista que a tela de rateio abre.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Persons_model.getByWorkspace(IdWorkspace)
    }
}
