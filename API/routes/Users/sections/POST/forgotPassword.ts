import { mailer } from "root/Utils/Connections/Mailer"
import { renderResetPassword } from "root/Utils/Mail/templates/resetPassword"
import { Users_model } from "../../Users.model"
import { ResetPasswordToken } from "../ResetPasswordToken.section"

//  "Esqueci minha senha", passo 1: manda o link.
//
//  **A rota responde 200 sempre**, inclusive para e-mail que não tem conta — e a `msg` é
//  literalmente a mesma. Sem isso ela vira um verificador de quais e-mails estão cadastrados,
//  que é a mesma razão pela qual o login usa uma `msg` só para e-mail errado e senha errada.
export class ForgotPassword {

    //  Uma frase que é verdade nos dois casos, e que não promete que o e-mail existe.
    private readonly message = "Se este e-mail tiver uma conta, enviamos o link de recuperação."

    public async run(Email: string) {
        let user = await Users_model.getByLogin(Email)

        //  Usuário inativo também não recebe: o `getByLogin` filtra `Active`, e recuperar a
        //  senha de uma conta desativada não devolveria acesso a nada.
        if (user) {
            let { subject, text, html } = renderResetPassword({
                Name: user.Name,
                Token: ResetPasswordToken.sign(user),
            })

            //  **Direto, sem fila e sem outbox.** O usuário está na tela esperando, e uma
            //  falha se recupera sozinha: ele pede de novo. O `send` não estoura — um SMTP
            //  fora do ar vira uma linha de log, nunca um 500 nesta resposta.
            //
            //  Também não vai por `attachOnEnd`: aqui não há transaction nenhuma. Nada foi
            //  gravado, então não existe commit para esperar.
            await mailer.send({ to: user.Email, subject, text, html })
        }

        return { msg: this.message }
    }
}
