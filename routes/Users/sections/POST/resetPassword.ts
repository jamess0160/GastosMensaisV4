import jwt from "jsonwebtoken"
import { Users_model } from "../../Users.model"
import { PasswordHasher } from "../PasswordHasher.section"
import { ResetPasswordToken, ResetTokenPayload } from "../ResetPasswordToken.section"

//  "Esqueci minha senha", passo 2: grava a senha nova.
//
//  A senha chega no **corpo**, nunca na URL — o path inteiro cai no log de acesso do proxy, no
//  histórico do navegador, no header `Referer` e no próprio `Logs.handleError` via
//  `req.originalUrl`. É a mesma razão pela qual o login e o `updatePassword` também recebem
//  corpo, e é o que faz o link do e-mail apontar para a tela em vez de para esta rota.
export class ResetPassword {
    public async run(Token: string, NewPassword: string) {
        //  O id sai do token para poder buscar o usuário, mas quem valida é o `verify` logo
        //  abaixo: o payload lido aqui ainda não passou por conferência nenhuma.
        let IdUser = this.readIdUser(Token)
        let user = IdUser ? await Users_model.getUnique(IdUser) : undefined

        ResetPasswordToken.verify(Token, user)

        //  O `PasswordHasher` continua sendo o único lugar que hasheia no projeto (bcrypt
        //  custo 12), e trocar a senha aqui já **invalida este mesmo token**: o hash muda, a
        //  impressão digital dentro dele deixa de casar, e o link vira papel velho.
        await Users_model.update(user!.IdUser, {
            Password: await PasswordHasher.hash(NewPassword),
        })

        return { msg: "Senha alterada com sucesso" }
    }

    //  `decode` e não `verify`: aqui só se quer saber a quem o token diz pertencer, para ter
    //  a linha do banco em mãos. Um token forjado passa por esta leitura e morre no `verify`,
    //  que é onde a assinatura, o tipo e a impressão digital são conferidos.
    private readIdUser(Token: string) {
        let payload = jwt.decode(Token) as ResetTokenPayload | null

        return typeof payload?.IdUser === "number" ? payload.IdUser : null
    }
}
