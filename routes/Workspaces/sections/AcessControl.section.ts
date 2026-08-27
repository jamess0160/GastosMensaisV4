import { APIError } from "root/Utils/Logs"
import { WorkspaceMembers_model } from "../WorkspaceMembers.model"

//  O IdWorkspace chega pela URL, ou seja, vem do cliente: nada garante que seja do usuário do
//  token. Toda rota escopada por tenant passa por aqui antes de ler ou escrever qualquer coisa.
class Controller {

    public async assertMember(IdWorkspace: number, IdUser: number) {
        let membership = await WorkspaceMembers_model.getMembership(IdWorkspace, IdUser)

        //  404 diria ao cliente que o workspace existe; para quem não é membro ele não existe.
        if (!membership) {
            throw new APIError({
                msg: "Workspace não encontrado!",
                status: 406,
                data: { IdWorkspace, IdUser },
            })
        }

        return membership
    }

    public async assertRole(IdWorkspace: number, IdUser: number, roles: Array<"owner" | "editor" | "viewer">) {
        let membership = await this.assertMember(IdWorkspace, IdUser)

        if (!roles.includes(membership.Role)) {
            throw new APIError({
                msg: "Você não tem permissão para essa ação neste workspace.",
                status: 403,
                data: { IdWorkspace, IdUser, Role: membership.Role },
            })
        }

        return membership
    }
}

export const WorkspacesAcessControl = new Controller()
