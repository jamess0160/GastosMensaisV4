import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Persons_model } from "../../Persons.model"

//  Arquiva a pessoa (Active = false).
//
//  Não é delete físico: ExpensePersons e InflowPersons apontam para cá com ON DELETE RESTRICT,
//  e o rateio de março tem que continuar apontando para quem de fato entrou nele.
export class Remove {
    public async run(SelectedIdWorkspace: number, IdPerson: number, IdUser: number) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let person = await Persons_model.getUnique(IdWorkspace, IdPerson)

        if (!person) {
            throw new APIError({
                msg: "Pessoa não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPerson },
            })
        }

        //  A pessoa vinculada a um login não é arquivável, e o motivo é que seria irreversível:
        //  o IdUser é `unique` no banco inteiro e só o cadastro do usuário o escreve, então uma
        //  Person nova criada no lugar dela nasceria sem vínculo — o usuário ficaria fora de
        //  qualquer rateio futuro, sem rota que desfizesse. Quem desfaz o vínculo é a saída do
        //  membro do workspace, na etapa 9.
        if (person.IdUser !== null) {
            throw new APIError({
                msg: "Esta pessoa representa um usuário do workspace e não pode ser arquivada.",
                status: 406,
                data: { IdPerson, IdUser: person.IdUser },
            })
        }

        await Persons_model.delete(IdPerson)

        return { msg: "Pessoa arquivada com sucesso" }
    }
}
