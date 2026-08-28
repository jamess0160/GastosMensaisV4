import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Utils } from "root/Utils/Utils"
import { Categories_model } from "../../Categories.model"

//  As categorias do workspace e as pré-definidas do sistema (IdWorkspace nulo), em árvore.
//
//  Vêm juntas porque é junto que a tela de lançar gasto usa: para quem acabou de se cadastrar,
//  as globais são as únicas que existem, e separá-las em duas listas obrigaria o cliente a
//  concatenar duas chamadas para montar um único seletor.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number) {
        //  Leitura é de qualquer membro, inclusive viewer. O IdWorkspace usado na consulta é o
        //  que volta da matrícula, não o que veio do token.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        let categories = await Categories_model.getByWorkspace(IdWorkspace)

        let visible = new Set(categories.map((category) => category.IdCategory))

        //  A árvore é uma vista da lista plana: nada pode sumir na montagem. O buildTree
        //  pendura o nó no pai e descarta quem não achou o seu, então a categoria cujo pai
        //  saiu da lista (arquivado, de outro tenant) desapareceria da resposta continuando
        //  ativa no banco. Aqui ela sobe para a raiz em vez de sumir.
        return Utils.buildTree(
            categories,
            (category) => category.IdCategory,
            (category) => category.IdParentCategory && visible.has(category.IdParentCategory) ? category.IdParentCategory : null,
        )
    }
}
