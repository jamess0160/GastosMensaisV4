import { mailer } from "root/Utils/Connections/Mailer"
import { renderConfirmEmail } from "root/Utils/Mail/templates/confirmEmail"
import { Database } from "root/Utils/database"
import { EmailConfirmationToken } from "./EmailConfirmationToken.section"

//  **O único lugar que dispara o e-mail de confirmação**, e ele tem três chamadores: o
//  cadastro, o `PUT /Users` quando o endereço muda, e o `resendConfirmation`.
//
//  Centralizar aqui é o que impede os três de divergirem no que mandam — é a mesma razão pela
//  qual `AcessControl.startSession` é o único lugar que emite sessão, com o login por senha e
//  o por biometria terminando nele.
class Controller {

    /**
     * Manda o e-mail, se houver o que confirmar. Devolve se saiu.
     *
     * **Já confirmado não recebe nada**, e a guarda mora aqui e não em cada chamador: um
     * e-mail "confirme seu endereço" para quem já confirmou é ruído, e no `resendConfirmation`
     * seria pior — bastaria repetir a chamada para incomodar o dono de uma conta alheia.
     */
    public async run(user: Database.Users) {
        if (user.EmailConfirmedAt) {
            return false
        }

        let { subject, text, html } = renderConfirmEmail({
            Name: user.Name,
            Token: EmailConfirmationToken.sign(user),
        })

        //  O `send` não estoura: um SMTP fora do ar vira linha de log, nunca um 500 no
        //  cadastro de quem está na tela. É o que permite pendurar isto no `attachOnEnd` sem
        //  medo de desfazer a transaction que acabou de fechar.
        return await mailer.send({ to: user.Email, subject, text, html })
    }
}

export const SendEmailConfirmation = new Controller()
