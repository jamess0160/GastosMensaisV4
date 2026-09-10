import { KnexConnection, KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { Create as CreateWorkspace } from "root/routes/Workspaces/sections/POST/create"
import { InviteAcceptance } from "root/routes/Workspaces/sections/InviteAcceptance.section"
import { CreateSelf as CreateSelfPerson } from "root/routes/Persons/sections/POST/createSelf"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"
import { SendEmailConfirmation } from "../SendEmailConfirmation.section"
import { TERMS_VERSION } from "../TermsVersion"
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

        return await KnexTransaction(async (tx, events) => {

            let IdUser = await Users_model.create({
                Name: body.Name,
                Email: body.Email,
                Phone: body.Phone,
                Password: await PasswordHasher.hash(body.Password),
                //  O aceite vira registro na MESMA escrita que cria a conta: uma conta viva
                //  sem a prova de consentimento é justamente o estado que a coluna existe
                //  para impedir, e um UPDATE separado depois do commit falha sozinho.
                //
                //  A data é a do BANCO, como no carimbo do `confirmEmail`: quem aceita não
                //  escolhe quando aceitou. E a versão é a da API, nunca a do corpo — o
                //  cliente diz QUE aceitou (o `AcceptedTerms`, que o Joi só deixa passar
                //  como `true`), e COM O QUE ele concordou quem responde é o servidor.
                TermsAcceptedAt: KnexConnection.fn.now() as unknown as Database.Users["TermsAcceptedAt"],
                TermsVersion: TERMS_VERSION,
            }).transacting(tx).returnId("IdUser")

            //  O e-mail de confirmação pendura no `attachOnEnd`, nunca dentro da transaction:
            //  o `fireOnEnd` roda DEPOIS do commit, então um cadastro que rolou para trás não
            //  manda nada — e um SMTP fora do ar não desfaz uma conta que já existe.
            //
            //  A linha é relida ali dentro, e não montada com o que veio no corpo: o que o
            //  e-mail atesta tem que ser o que foi realmente gravado.
            events.attachOnEnd(async () => {
                let created = await Users_model.getUnique(IdUser)

                if (created) await SendEmailConfirmation.run(created)
            })

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
