import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Persons_model } from "../../Persons.model"
import { PersonName } from "../PersonName.section"
import { PersonsNamespace } from "../types"

export class Update {
    public async run(SelectedIdWorkspace: number, IdPerson: number, IdUser: number, body: PersonsNamespace.UpdatePersonPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let person = await Persons_model.getUnique(IdWorkspace, IdPerson)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdPerson existem nos outros tenants.
        if (!person) {
            throw new APIError({
                msg: "Pessoa não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPerson },
            })
        }

        await PersonName.assertNameIsFree(IdWorkspace, body.Name, IdPerson)

        //  Só o nome muda. O IdUser fica de fora do body inteiro — renomear a pessoa que
        //  representa um usuário é normal, apontá-la para outro login não é edição de cadastro.
        await Persons_model.update(IdPerson, { Name: body.Name })

        return { msg: "Pessoa atualizada com sucesso" }
    }
}
