import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { Create as CreateWorkspace } from "root/routes/Workspaces/sections/POST/create"
import { InviteAcceptance } from "root/routes/Workspaces/sections/InviteAcceptance.section"
import { CreateSelf as CreateSelfPerson } from "root/routes/Persons/sections/POST/createSelf"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"
import { UsersNamespace } from "../types"

//  Cadastro. Usuário, workspace e a Person do próprio dono nascem juntos: todo dado de domínio
//  é escopado por IdWorkspace, então um usuário sem workspace não consegue lançar nada — seria
//  uma conta pela metade —, e todo rateio é entre Persons, então sem a pessoa dele o usuário
//  não conseguiria entrar no próprio. Por isso as três escritas vão na mesma transaction.
//
//  Com InviteHash o cadastro é o segundo caminho de aceite de convite: não nasce workspace
//  novo, nasce a matrícula no workspace do convite, com o papel que ELE manda. Antes disso a
//  rota aceitava um IdWorkspace do corpo e entrava como 'owner' de qualquer tenant — o campo
//  foi trocado pelo hash porque id sequencial se adivinha contando, 32 bytes aleatórios não.
export class Create {
    public async run(body: UsersNamespace.CreateUserPayload) {
        await this.assertEmailIsFree(body.Email)

        //  As duas conferências do convite acontecem ANTES da transaction: o caminho de erro
        //  não deve segurar conexão, e o e-mail errado é o caso comum (link repassado).
        let invite = await this.resolveInvite(body)

        return await KnexTransaction(async (tx) => {

            let IdUser = await Users_model.create({
                Name: body.Name,
                Email: body.Email,
                Phone: body.Phone,
                Password: await PasswordHasher.hash(body.Password),
            }).transacting(tx).returnId("IdUser")

            //  O aceite grava matrícula, Person e a baixa do convite na MESMA transaction do
            //  usuário: um convite marcado como aceito por um cadastro que caiu deixaria o
            //  convidado de fora e sem como tentar de novo.
            if (invite) {
                let IdWorkspace = await InviteAcceptance.accept(tx, invite, IdUser, body.Name)

                return { IdUser, IdWorkspace }
            }

            let IdWorkspace = await new CreateWorkspace(tx).run(IdUser, body.Name)

            //  O único lugar que escreve o IdUser de uma Person: o valor vem do usuário
            //  inserido aqui em cima, nunca do corpo da requisição.
            await new CreateSelfPerson(tx).run(IdWorkspace, IdUser, body.Name)

            return { IdUser, IdWorkspace }
        })
    }

    //  Sem hash não há convite: o usuário nasce dono do próprio workspace, como sempre.
    private async resolveInvite(body: UsersNamespace.CreateUserPayload): Promise<Database.WorkspaceInvites | null> {
        if (!body.InviteHash) return null

        let invite = await InviteAcceptance.resolve(body.InviteHash)

        //  Aqui o e-mail conferido é o do CORPO — no join é o da sessão. É a mesma regra nos
        //  dois: a conta que aceita tem que ser a que foi convidada. Sem isso o link repassado
        //  entraria, e o link é compartilhável por desenho.
        InviteAcceptance.assertEmail(invite, body.Email)

        return invite
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
