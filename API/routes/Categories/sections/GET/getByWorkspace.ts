import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

//  As categorias do workspace, e só elas.
//
//  **A lista já não tem dois donos.** As treze pré-definidas eram linhas globais (IdWorkspace
//  nulo) que apareciam aqui ao lado das próprias; a migration 20260922140000 deu a cada espaço
//  a sua cópia, e um workspace novo nasce com as treze pela criação, não pela leitura. Quem se
//  acabou de cadastrar continua tendo com o que lançar o primeiro gasto — o que mudou é que
//  agora ele pode arquivar e reordenar essas treze, que é o que elas nunca deixaram fazer.
//
//  Lista plana: não há categoria filha de outra. A hierarquia existiu e foi derrubada — ela
//  cobrava conferência de pai, recusa de ciclo e arrasto de subárvore no arquivamento, e nada
//  disso se pagava com um punhado de categorias por workspace.
//
//  **`IncludeArchived` é o recorte que faltava para arquivar ter volta.** Sem ele a categoria
//  arquivada não aparecia em lugar nenhum: sumia da tela junto com o botão que a traria de
//  volta, e "arquivar" era um delete com outro nome. É o mesmo parâmetro, com o mesmo nome e o
//  mesmo significado, que `GET /Expenses` usa para os cancelados — ausente esconde, presente
//  traz a lista inteira, e quem separa os dois grupos é o cliente, numa requisição só.
//
//  O padrão é **esconder**, e isso não é conveniência: o seletor de gasto, o filtro da lista e
//  o relatório leem esta mesma rota, e nenhum deles pode passar a oferecer uma categoria
//  arquivada. Quem pede a lista inteira é só a tela de Personalização.
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number, filters: CategoriesNamespace.ListFilters) {
        //  Leitura é de qualquer membro, inclusive viewer. O IdWorkspace usado na consulta é o
        //  que volta da matrícula, não o que veio do token.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Categories_model.getByWorkspace(IdWorkspace, filters.IncludeArchived)
    }
}
