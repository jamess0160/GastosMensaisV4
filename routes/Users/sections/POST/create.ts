import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Create as CreateWorkspace } from "root/routes/Workspaces/sections/POST/create"
import { CreateSelf as CreateSelfPerson } from "root/routes/Persons/sections/POST/createSelf"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"
import { UsersNamespace } from "../types"

//  Cadastro. Usuário, workspace e a Person do próprio dono nascem juntos: todo dado de domínio
//  é escopado por IdWorkspace, então um usuário sem workspace não consegue lançar nada — seria
//  uma conta pela metade —, e todo rateio é entre Persons, então sem a pessoa dele o usuário
//  não conseguiria entrar no próprio. Por isso as três escritas vão na mesma transaction.
export class Create {
    public async run(body: UsersNamespace.CreateUserPayload) {
        await this.assertEmailIsFree(body.Email)

        return await KnexTransaction(async (tx) => {

            let IdUser = await Users_model.create({
                Name: body.Name,
                Email: body.Email,
                Phone: body.Phone,
                Password: await PasswordHasher.hash(body.Password),
            }).transacting(tx).returnId("IdUser")

            let IdWorkspace = await new CreateWorkspace(tx).run(IdUser, body.Name, body.IdWorkspace)

            //  O único lugar que escreve o IdUser de uma Person: o valor vem do usuário
            //  inserido aqui em cima, nunca do corpo da requisição.
            await new CreateSelfPerson(tx).run(IdWorkspace, IdUser, body.Name)

            return { IdUser, IdWorkspace }
        })
    }

    //  Checagem amigável antes da transaction. O índice único de Email continua sendo a
    //  garantia de verdade (duas requisições simultâneas passam as duas por aqui); esta
    //  verificação existe só para o caso normal responder 406 em vez de estourar 500.
    private async assertEmailIsFree(Email: string) {
        //  Sem o filtro de Active: um usuário desativado ainda ocupa o e-mail no índice único.
        let existing = await Users_model.getByEmailIncludingInactive(Email)

        if (existing) {
            throw new APIError({
                msg: "Já existe um usuário cadastrado com esse e-mail.",
                status: 406,
            })
        }
    }
}
