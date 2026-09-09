import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Tags_model } from "../../Tags.model"

//  A única leitura de tags: a sugestão do input, enquanto o usuário digita a tag do gasto.
//
//  É uma busca e não uma listagem porque não existe tela de "minhas tags": a tag só aparece
//  onde ela é usada — dentro do gasto. Sem termo, devolve as primeiras em ordem de nome, que é
//  o que o input mostra ao abrir.
export class Search {
    public async run(SelectedIdWorkspace: number, IdUser: number, Search?: string) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Tags_model.search(IdWorkspace, Search)
    }
}
