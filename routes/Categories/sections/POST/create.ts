import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

//  Cria uma categoria do workspace. A global não nasce por aqui: ela vem da migration de seed
//  e é a mesma linha para todos os workspaces — criar uma pela rota seria escrever no cadastro
//  de todo mundo. Por isso o IdWorkspace gravado é sempre o da matrícula, nunca nulo.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: CategoriesNamespace.CreateCategoryPayload) {
        //  Viewer lê o workspace, não cadastra dentro dele.
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  Categories não tem IdUser: a categoria é do workspace, não de quem a cadastrou.
        let IdCategory = await Categories_model.create({ ...body, IdWorkspace }).returnId("IdCategory")

        return { IdCategory }
    }
}
