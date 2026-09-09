import { Database } from "root/Utils/database"
import { Workspaces_model } from "../../Workspaces.model"

//  Os workspaces do usuário do token, com o da SESSÃO marcado.
//
//  O `Current` não é coluna e nem podia ser: ele não descreve o workspace, descreve o token que
//  chegou nesta requisição — o mesmo workspace é `true` numa aba e `false` na outra. Ele existe
//  porque o cliente não tem como saber a resposta sozinho: a seleção vive dentro do JWT e o
//  cookie é `HttpOnly`. Sem este campo o front chuta o primeiro da lista, e um chute errado faz
//  a tela AFIRMAR um espaço enquanto os lançamentos vão para outro.
export class GetSelf {
    public async run(IdUser: number, IdWorkspace: number) {
        let workspaces = await Workspaces_model.getByMember(IdUser)

        return workspaces.map((workspace: Database.Workspaces) => ({
            ...workspace,
            Current: workspace.IdWorkspace === IdWorkspace,
        }))
    }
}
