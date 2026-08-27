import { Knex } from "knex"
import { class_Workspaces_model } from "../../Workspaces.model"
import { class_WorkspaceMembers_model } from "../../WorkspaceMembers.model"

//  Cria o workspace e já matricula o dono nele.
//
//  Recebe a transaction em vez de abrir a sua: quem chama é o cadastro de usuário, e um
//  workspace sem linha em WorkspaceMembers é um tenant órfão — nenhuma leitura o enxerga,
//  porque getByMember filtra por matrícula. As duas escritas têm que cair ou passar juntas.
export class Create {

    private readonly Workspaces_model: class_Workspaces_model
    private readonly WorkspaceMembers_model: class_WorkspaceMembers_model

    constructor(tx: Knex.Transaction) {
        this.Workspaces_model = new class_Workspaces_model(tx)
        this.WorkspaceMembers_model = new class_WorkspaceMembers_model(tx)
    }

    public async run(IdOwnerUser: number, Name: string, IdWorkspace?: number) {
        if (!IdWorkspace) {
            IdWorkspace = await this.Workspaces_model.create({ Name, IdOwnerUser }).returnId("IdWorkspace")
        }

        await this.WorkspaceMembers_model.create({ IdWorkspace, IdUser: IdOwnerUser, Role: "owner" })

        return IdWorkspace
    }
}
