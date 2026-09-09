import jwt from "jsonwebtoken"
import { Users_model } from "../../Users.model"
import { ConfirmationTokenPayload, EmailConfirmationToken } from "../EmailConfirmationToken.section"

//  Confirmação de e-mail, passo 2: carimba o `EmailConfirmedAt`.
//
//  **Confirmar duas vezes não é erro.** A segunda chamada encontra a coluna preenchida e
//  responde 200 sem escrever nada. Quem clica no link de novo — ou o pré-carregador de link do
//  cliente de e-mail, que abre a URL sem ninguém ter pedido — não pode ver tela de erro para
//  uma coisa que já deu certo.
export class ConfirmEmail {
    public async run(Token: string) {
        //  O id sai do token só para achar a linha; quem valida é o `verify` logo abaixo.
        let IdUser = this.readIdUser(Token)
        let user = IdUser ? await Users_model.getUnique(IdUser) : undefined

        EmailConfirmationToken.verify(Token, user)

        //  Idempotente de propósito. Reescrever a data no segundo clique moveria o instante da
        //  confirmação para o do pré-carregador de link, e essa data é a única prova de quando
        //  o endereço foi provado.
        if (!user!.EmailConfirmedAt) {
            await Users_model.confirmEmail(user!.IdUser)
        }

        return { msg: "E-mail confirmado com sucesso" }
    }

    //  `decode` e não `verify`: aqui só se quer saber a quem o token diz pertencer, para ter a
    //  linha em mãos. Um token forjado passa por esta leitura e morre no `verify`.
    private readIdUser(Token: string) {
        let payload = jwt.decode(Token) as ConfirmationTokenPayload | null

        return typeof payload?.IdUser === "number" ? payload.IdUser : null
    }
}
