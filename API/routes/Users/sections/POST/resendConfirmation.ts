import { Users_model } from "../../Users.model"
import { MailCooldown } from "../MailCooldown.section"
import { SendEmailConfirmation } from "../SendEmailConfirmation.section"

//  Confirmação de e-mail, passo 1 quando o primeiro e-mail se perdeu.
//
//  **A rota responde 200 sempre**, inclusive para e-mail que não tem conta, e com a mesma
//  `msg` — pela mesma razão do `forgotPassword`: senão ela vira um verificador de quais
//  endereços estão cadastrados. É pública porque quem ainda não confirmou pode perfeitamente
//  não ter sessão nenhuma: o e-mail do cadastro é o caso comum de "não chegou".
export class ResendConfirmation {

    //  Uma frase que é verdade nos dois casos, e que não promete que a conta existe.
    private readonly message = "Se este e-mail tiver uma conta pendente de confirmação, enviamos o link."

    public async run(Email: string) {
        //  O cooldown vem ANTES da consulta, e a chave é o e-mail que chegou: consultar
        //  primeiro faria o freio custar um SELECT por tentativa, que é justamente o que um
        //  laço quer. E ele não muda a resposta — ver `MailCooldown`.
        if (!MailCooldown.claim(`resendConfirmation:${Email}`)) {
            return { msg: this.message }
        }

        //  `getByLogin` filtra `Active`: reenviar a confirmação de uma conta desativada não
        //  devolveria acesso a nada. Já confirmado também não recebe — a guarda mora no
        //  `SendEmailConfirmation`, que é o único lugar que manda este e-mail.
        let user = await Users_model.getByLogin(Email)

        if (user) {
            await SendEmailConfirmation.run(user)
        }

        return { msg: this.message }
    }
}
