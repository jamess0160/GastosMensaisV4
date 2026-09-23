import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"

//  Arquiva a categoria (Active = false).
//
//  Não é delete físico: Expenses e Budgets apontam para cá, e o gasto de março tem que
//  continuar apontando para a categoria em que foi lançado. Arquivar tira das listas de
//  escolha sem tocar no histórico — o mesmo desenho do DELETE de Accounts.
//
//  Uma linha só: sem hierarquia não há subárvore para arrastar junto.
//
//  **E agora arquivar funciona de verdade.** Enquanto as treze pré-definidas eram globais
//  (IdWorkspace nulo), o `Active = false` caía num `where("IdWorkspace", X)` que nunca casava
//  com nulo — a operação não tinha efeito nenhum, e era o retorno número um de quem usa o app.
//  Cada espaço tem as suas cópias desde a migration 20260922140000.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdCategory: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let category = await Categories_model.getUnique(IdWorkspace, IdCategory)

        //  Um id que não é deste espaço não existe aqui — o mesmo 406 de qualquer id alheio.
        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        await Categories_model.delete(IdWorkspace, IdCategory)

        return { msg: "Categoria arquivada com sucesso" }
    }
}
