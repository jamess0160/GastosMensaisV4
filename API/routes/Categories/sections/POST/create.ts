import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

//  Cria uma categoria do workspace. O IdWorkspace gravado é sempre o da matrícula — não há
//  mais categoria sem dono, e a coluna é NOT NULL desde a migration 20260922140000.
//
//  As treze pré-definidas não nascem por aqui: elas são semeadas na criação do workspace, com
//  a lista do Categories.seed.ts.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: CategoriesNamespace.CreateCategoryPayload) {
        //  Viewer lê o workspace, não cadastra dentro dele.
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  Categories não tem IdUser: a categoria é do workspace, não de quem a cadastrou.
        let IdCategory = await Categories_model.create({ ...body, IdWorkspace }).returnId("IdCategory")

        return { IdCategory }
    }
}
