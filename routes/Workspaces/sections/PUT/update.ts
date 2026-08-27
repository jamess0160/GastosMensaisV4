import { Workspaces_model } from "../../Workspaces.model"
import { WorkspacesAcessControl } from "../AcessControl.section"
import { WorkspacesNamespace } from "../types"

export class Update {
    public async run(IdWorkspace: number, IdUser: number, body: WorkspacesNamespace.UpdateWorkspacePayload) {
        //  Renomear o tenant é do dono; editor e viewer mexem no conteúdo, não no workspace.
        await WorkspacesAcessControl.assertRole(IdWorkspace, IdUser, ["owner"])

        await Workspaces_model.update(IdWorkspace, body)

        return { msg: "Workspace atualizado com sucesso" }
    }
}
