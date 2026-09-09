import jwt from "jsonwebtoken"
import { enviromentManager } from "root/Utils/enviromentManager"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"

//  O token da confirmação de e-mail: **o mesmo padrão do `ResetPasswordToken`** — um JWT
//  curto, sem tabela nova. É o terceiro token deste desenho no projeto (o primeiro é o
//  `ChallengeToken` da biometria), e a razão é sempre a mesma: provar que um dado veio da API
//  e não do cliente, sem guardar estado entre duas requisições.
//
//  **Uso único por construção, e o mecanismo aqui é o próprio e-mail.** O token carrega
//  `{ IdUser, Email, type }`, e o `Email` é conferido contra o que está gravado na linha:
//  confirmar preenche o `EmailConfirmedAt`, e trocar o endereço faz o token antigo deixar de
//  casar. É o análogo exato da impressão digital da senha na recuperação — o dado que o token
//  atesta é também o que o mata quando muda.
//
//  O `type` é obrigatório pela mesma razão que nos outros dois: um token de outra finalidade,
//  assinado com o MESMO `JWT_SECRET`, não pode ser gasto aqui. Sem ele um link de recuperação
//  de senha confirmaria um e-mail, e vice-versa.
class Controller {

    //  Bem mais longa que os 30 minutos da recuperação, e de propósito: aquele token é uma
    //  credencial de troca de senha, pedida por quem está na tela naquele instante; este chega
    //  no cadastro e é aberto quando a pessoa volta à caixa de entrada — de noite, no dia
    //  seguinte. Um link que morre em meia hora aqui só gera reenvio.
    private readonly expiresIn = "48h"

    private readonly type = "confirm"

    public sign(user: Database.Users) {
        return jwt.sign(
            { IdUser: user.IdUser, Email: user.Email, type: this.type },
            enviromentManager.getEnv("JWT_SECRET"),
            { expiresIn: this.expiresIn },
        )
    }

    /**
     * Confere o token contra o usuário que ele aponta, e devolve o payload.
     *
     * **Uma `msg` só para todos os motivos** — assinatura errada, expirado, tipo errado,
     * e-mail já trocado —, como na recuperação de senha: a ação da tela é a mesma em todos os
     * casos, pedir outro link, e distinguir só ajudaria quem está testando tokens.
     */
    public verify(token: string, user: Database.Users | undefined) {
        let payload: ConfirmationTokenPayload

        try {
            payload = jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as ConfirmationTokenPayload
        } catch (error) {
            throw this.invalid()
        }

        if (payload.type !== this.type) {
            throw this.invalid({ type: payload.type })
        }

        if (!user || user.IdUser !== payload.IdUser) {
            throw this.invalid()
        }

        //  O uso único. Depois de o endereço mudar, o link que ficou na caixa de entrada do
        //  endereço antigo não confirma mais nada — que é exatamente o que se quer: ele prova
        //  a posse daquele endereço, e daquele endereço só.
        if (payload.Email !== user.Email) {
            throw this.invalid()
        }

        return payload
    }

    private invalid(data?: any) {
        return new APIError({
            msg: "Link de confirmação inválido ou expirado. Peça um novo.",
            status: 406,
            data,
        })
    }
}

export interface ConfirmationTokenPayload {
    IdUser: number
    /** O endereço que o token atesta — e o que o torna de uso único. */
    Email: string
    type: "confirm"
}

export const EmailConfirmationToken = new Controller()
