import { Workspaces_model } from "../../Workspaces.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { WorkspacesNamespace } from "../types"

export class Update {
    //  SelectedIdWorkspace é o valor que veio do token: assinado, mas emitido no login. O
    //  IdWorkspace usado na escrita é o que volta da matrícula, conferido contra o banco agora —
    //  é o que impede um workspace já revogado de chegar sozinho até uma query.
    public async run(SelectedIdWorkspace: number, IdUser: number, body: WorkspacesNamespace.UpdateWorkspacePayload) {
        //  Renomear o tenant é do dono; editor e viewer mexem no conteúdo, não no workspace.
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner"])

        await Workspaces_model.update(IdWorkspace, body)

        return { msg: "Workspace atualizado com sucesso" }
    }
}
