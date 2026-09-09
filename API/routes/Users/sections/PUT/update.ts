import { Users_model } from "../../Users.model"
import { SendEmailConfirmation } from "../SendEmailConfirmation.section"
import { UsersNamespace } from "../types"

//  **Trocar o e-mail derruba a confirmação, e é a linha que faz a etapa inteira valer.** Sem
//  ela eu confirmo `a@x.com`, troco para `b@y.com` e continuo "confirmado" num endereço que
//  nunca provei ser meu — o carimbo passaria a atestar uma coisa que não aconteceu.
//
//  O token antigo morre junto, sem nada acontecer aqui: ele carrega o endereço que atestava, e
//  o `EmailConfirmationToken.verify` o compara com o que está gravado.
export class Update {
    public async run(IdUser: number, body: UsersNamespace.UpdateUserPayload) {
        let current = await Users_model.getUnique(IdUser)

        //  Comparação com o que está no banco, e não "veio Email no corpo": o `PUT` é
        //  substituição, então o endereço chega em toda chamada — inclusive nas que só mudam o
        //  nome. Zerar a confirmação nessas seria cobrar de novo por um endereço já provado.
        let changedEmail = !!current && current.Email !== body.Email

        await Users_model.update(IdUser, changedEmail ? { ...body, EmailConfirmedAt: null } : body)

        if (changedEmail) {
            let updated = await Users_model.getUnique(IdUser)

            //  Direto, sem `attachOnEnd`: aqui não há transaction — é um UPDATE só, e ele já
            //  está gravado quando esta linha roda.
            if (updated) await SendEmailConfirmation.run(updated)
        }
    }
}
