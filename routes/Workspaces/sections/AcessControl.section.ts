import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { WorkspaceMembers_model } from "../WorkspaceMembers.model"

//  O IdWorkspace chega assinado dentro do token, então o cliente não o forjou. Isso NÃO
//  dispensa esta checagem: o token é uma fotografia da autorização no instante do login e vale
//  24h, então a matrícula pode ter sido revogada, ou o papel rebaixado, depois de emitido.
//  Autenticação (quem é) o token resolve; autorização (ainda pode?) só o banco responde.
//
//  Toda rota escopada por tenant passa por aqui antes de ler ou escrever qualquer coisa.
//
//  Devolve a matrícula, e é dela que as sections tiram o IdWorkspace daí em diante: o número
//  que volta veio do banco e está conferido agora, não quando o token nasceu. É isso que
//  impede o valor do token de chegar sozinho até uma query.
class Controller {

    public async assertMember(IdWorkspace: number | undefined, IdUser: number) {
        //  Sessão sem workspace selecionado: o token foi emitido para um usuário sem nenhuma
        //  matrícula. Mensagem própria porque
        //  o conserto é outro — chamar POST /Base/Workspaces/switch, não pedir acesso.
        if (!IdWorkspace) {
            throw new APIError({
                msg: "Nenhum workspace selecionado.",
                status: 406,
                data: { IdUser },
            })
        }

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

    public async assertRole(IdWorkspace: number | undefined, IdUser: number, roles: Array<Database.WorkspaceMembers["Role"]>) {
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
