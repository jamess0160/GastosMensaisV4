import { Workspaces_model } from "../../Workspaces.model"

//  Os workspaces do usuário do token. Hoje é sempre um só (o que nasce junto com a conta),
//  mas a lista já vem como array porque WorkspaceMembers existe para o compartilhamento.
export class GetSelf {
    public run(IdUser: number) {
        return Workspaces_model.getByMember(IdUser)
    }
}
