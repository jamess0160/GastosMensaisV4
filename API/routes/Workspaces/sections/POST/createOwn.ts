import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Users_model } from "root/routes/Users/Users.model"
import { CreateSelf as CreateSelfPerson } from "root/routes/Persons/sections/POST/createSelf"
import { Create as CreateWorkspace } from "./create"
import { WorkspacesNamespace } from "../types"

//  O usuário cria um workspace novo para si — o terceiro e último jeito de um workspace passar
//  a existir para alguém, ao lado do cadastro (que cria o primeiro) e do convite (que dá
//  matrícula num alheio). Faltava o caso do meio: quem já tem conta e quer separar as finanças
//  em mais de um lugar (a casa e a empresa, o orçamento pessoal e o do casal) só conseguia
//  criando outra conta com outro e-mail.
//
//  Não é a Create de ./create.ts porque aquela recebe a transaction de quem chama e é a peça
//  compartilhada pelo cadastro e pelo aceite de convite. Esta é o nível HTTP: abre a
//  transaction, resolve o nome da pessoa e devolve o id. Juntar as duas obrigaria a peça de
//  baixo a saber de sessão.
//
//  Sem assertMember: é a única rota de Workspaces que não olha matrícula, porque o workspace
//  ainda não existe. O que ela escreve é escopado pelo IdUser do token, e por nada do corpo.
//
//  Não reemite o token, pela mesma razão do join: criar dá matrícula, não troca a sessão — a
//  tela em que o usuário estava continua sendo a que ele estava usando. Quem quiser operar no
//  workspace novo chama POST /Workspaces/switch com o id que voltou.
export class CreateOwn {
    public async run(IdUser: number, body: WorkspacesNamespace.CreateWorkspacePayload) {
        let user = await Users_model.getUnique(IdUser)

        //  O token é assinado, então o usuário existia quando ele foi emitido; chegar aqui sem
        //  a linha é conta desativada ou apagada depois disso.
        if (!user) {
            throw new APIError({
                msg: "Usuário não encontrado!",
                status: 406,
                data: { IdUser },
            })
        }

        return await KnexTransaction(async (tx) => {
            //  Quem cria entra como 'owner': é o default da peça de baixo, e é o papel de quem
            //  não foi convidado por ninguém.
            let IdWorkspace = await new CreateWorkspace(tx).run(IdUser, body.Name)

            //  A Person do dono no workspace novo, na mesma transaction — todo rateio é entre
            //  Persons, então sem ela o criador não apareceria no próprio gasto. O nome é o do
            //  USUÁRIO, não o do workspace: no cadastro os dois coincidem, aqui não.
            //
            //  A createSelf continua sendo o único lugar que escreve o IdUser de uma pessoa, e
            //  o valor vem da linha do usuário, nunca do corpo.
            await new CreateSelfPerson(tx).run(IdWorkspace, IdUser, user!.Name)

            return { IdWorkspace }
        })
    }
}
