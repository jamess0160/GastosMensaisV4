import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Tags_model } from "../../Tags.model"

//  Arquiva a tag (Active = false).
//
//  ExpenseTags aponta para cá com ON DELETE CASCADE, então o delete físico passaria e levaria
//  junto, em silêncio, a marcação de todos os gastos da viagem. Arquivar tira das listas de
//  escolha e deixa o histórico marcado.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdTag: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let tag = await Tags_model.getUnique(IdWorkspace, IdTag)

        if (!tag) {
            throw new APIError({
                msg: "Tag não encontrada!",
                status: 406,
                data: { IdWorkspace, IdTag },
            })
        }

        await Tags_model.delete(IdTag)

        return { msg: "Tag arquivada com sucesso" }
    }
}
