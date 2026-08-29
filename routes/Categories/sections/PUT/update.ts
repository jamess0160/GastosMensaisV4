import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"
import { CategoryOwnership } from "../CategoryOwnership.section"
import { CategoriesNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdCategory: number, IdUser: number, body: CategoriesNamespace.UpdateCategoryPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let category = await Categories_model.getUnique(IdWorkspace, IdCategory)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdCategory existem nos outros tenants.
        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        //  A linha global entra no getUnique porque é visível a todo mundo; o que ela não
        //  aceita é escrita. Editá-la renomearia a categoria de todos os workspaces da base.
        CategoryOwnership.assertEditable(category)

        await Categories_model.update(IdCategory, body)

        return { msg: "Categoria atualizada com sucesso" }
    }
}
