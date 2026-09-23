import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdCategory: number, IdUser: number, body: CategoriesNamespace.UpdateCategoryPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let category = await Categories_model.getUnique(IdWorkspace, IdCategory)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdCategory existem nos outros tenants.
        //
        //  E é a única resposta que sobrou. Enquanto existia a global (IdWorkspace nulo), o
        //  getUnique a encontrava e a escrita era recusada com um 406 próprio de "pré-definida
        //  do sistema". Acabaram as duas coisas: sem linha de ninguém, um id que não é deste
        //  espaço simplesmente não existe aqui — o mesmo tratamento de qualquer id alheio.
        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        await Categories_model.update(IdCategory, body)

        return { msg: "Categoria atualizada com sucesso" }
    }
}
