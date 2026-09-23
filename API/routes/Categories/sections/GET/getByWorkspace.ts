import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "../../Categories.model"

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
export class GetByWorkspace {
    public async run(SelectedIdWorkspace: number, IdUser: number) {
        //  Leitura é de qualquer membro, inclusive viewer. O IdWorkspace usado na consulta é o
        //  que volta da matrícula, não o que veio do token.
        let { IdWorkspace } = await WorkspacesAcessControl.assertMember(SelectedIdWorkspace, IdUser)

        return await Categories_model.getByWorkspace(IdWorkspace)
    }
}
