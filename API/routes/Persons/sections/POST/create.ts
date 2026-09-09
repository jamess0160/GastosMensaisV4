import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { Persons_model } from "../../Persons.model"
import { PersonName } from "../PersonName.section"
import { PersonsNamespace } from "../types"

//  Cadastra uma pessoa **sem login** — que é o caso para o qual a tabela existe.
//
//  O IdUser não é aceito por aqui, e isso é uma trava, não uma simplificação: ele é
//  `unique` no banco inteiro (não por workspace), então gravar o id de um usuário qualquer
//  consumiria para sempre a única vaga de Person daquele usuário, em qualquer workspace. Como
//  o id é sequencial, bastaria chutar. Quem escreve o vínculo é o cadastro do usuário
//  (POST/createSelf.ts), e a etapa 9 vai escrevê-lo de novo ao aceitar um convite.
export class Create {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: PersonsNamespace.CreatePersonPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        await PersonName.assertNameIsFree(IdWorkspace, body.Name)

        let IdPerson = await Persons_model.create({ Name: body.Name, IdWorkspace }).returnId("IdPerson")

        return { IdPerson }
    }
}
