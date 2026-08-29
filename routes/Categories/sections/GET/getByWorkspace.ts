import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "../../Categories.model"

//  As categorias do workspace e as pré-definidas do sistema (IdWorkspace nulo), numa lista só.
//
//  Vêm juntas porque é junto que a tela de lançar gasto usa: para quem acabou de se cadastrar,
//  as globais são as únicas que existem, e separá-las em duas listas obrigaria o cliente a
//  concatenar duas chamadas para montar um único seletor.
//
//  Lista plana: não há categoria filha de outra. A hierarquia existiu e foi derrubada — ela
//  cobrava conferência de pai, recusa de ciclo e arrasto de subárvore no arquivamento, e nada
//  disso se pagava com um punhado de categorias por workspace.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number) {
        //  Leitura é de qualquer membro, inclusive viewer. O IdWorkspace usado na consulta é o
        //  que volta da matrícula, não o que veio do token.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Categories_model.getByWorkspace(IdWorkspace)
    }
}
