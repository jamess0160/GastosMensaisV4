import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"
import { CategoryOwnership } from "../CategoryOwnership.section"
import { CategoryTree } from "../CategoryTree.section"

//  Arquiva a categoria e a subárvore dela (Active = false).
//
//  Não é delete físico: Expenses e Budgets apontam para cá, e o gasto de março tem que
//  continuar apontando para a categoria em que foi lançado. Arquivar tira das listas de
//  escolha sem tocar no histórico — o mesmo desenho do DELETE de Accounts.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdCategory: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let category = await Categories_model.getUnique(IdWorkspace, IdCategory)

        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        //  Arquivar a global a apagaria da lista de todos os workspaces de uma vez.
        CategoryOwnership.assertEditable(category)

        //  A subárvore vai junto, pelo mesmo motivo das formas de pagamento da conta: a filha
        //  que sobrevive ao pai arquivado some da árvore na montagem e continua sendo aceita
        //  como categoria de um gasto novo. Uma UPDATE só, então não precisa de transaction.
        let branch = await CategoryTree.getBranch(IdWorkspace, IdCategory)

        await Categories_model.deleteMany(IdWorkspace, branch)

        return { msg: "Categoria arquivada com sucesso" }
    }
}
