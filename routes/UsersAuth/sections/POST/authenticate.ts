import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { Response } from "express"
import { Database } from "root/Utils/database"
import { APIError } from "root/Utils/Logs"
import { AcessControl } from "root/routes/Users/sections/AcessControl.section"
import { Users_model } from "root/routes/Users/Users.model"
import { UsersAuth_model } from "../../UsersAuth.model"
import { UsersAuthNamespace } from "../types"
import { WebAuthnChallenge } from "../WebAuthnChallenge.section"
import { WebAuthnConfig } from "../WebAuthnConfig.section"

//  Passo 2 do login por biometria. Termina igual ao login por senha: mesma mensagem, mesmo
//  cookie, mesmo LastLogin — para o cliente os dois caminhos são intercambiáveis.
export class Authenticate {
    public async run(res: Response, body: UsersAuthNamespace.AuthenticatePayload) {
        let challenge = WebAuthnChallenge.verify(body.ChallengeToken, "login")

        let credential = await this.getCredential(body.Response.id)

        let verification = await verifyAuthenticationResponse({
            response: body.Response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: WebAuthnConfig.origins,
            expectedRPID: WebAuthnConfig.rpID,
            credential: {
                id: credential.CredentialId,
                publicKey: new Uint8Array(credential.PublicKey),
                counter: Number(credential.Counter),
            },
        }).catch((error) => {
            throw this.invalidCredential({ IdUserAuth: credential.IdUserAuth, reason: error?.message })
        })

        if (!verification.verified) {
            throw this.invalidCredential({ IdUserAuth: credential.IdUserAuth })
        }

        let user = await this.getUser(credential.IdUser)

        //  O contador só sobe. O autenticador incrementa a cada uso, então um valor que não
        //  avançou denuncia credencial clonada — a lib já barra isso no verify acima, e
        //  gravar o novo valor é o que mantém a checagem valendo na próxima vez.
        await UsersAuth_model.update(credential.IdUserAuth, { Counter: verification.authenticationInfo.newCounter })

        await AcessControl.startSession(res, user.IdUser)

        return { msg: "Login realizado com sucesso" }
    }

    private async getCredential(CredentialId: string) {
        let credential = await UsersAuth_model.getByCredentialId(CredentialId)

        if (!credential) {
            throw this.invalidCredential({ CredentialId })
        }

        return credential
    }

    //  O usuário pode ter sido desativado depois de a passkey ser criada: a credencial
    //  continua válida criptograficamente, mas a conta não pode mais entrar.
    private async getUser(IdUser: number): Promise<Database.Users> {
        let user = await Users_model.getUnique(IdUser)

        if (!user) {
            throw this.invalidCredential({ IdUser })
        }

        return user
    }

    //  Uma única resposta para todas as recusas, como no login por senha: distinguir
    //  "credencial não existe" de "assinatura não confere" entrega informação de graça.
    private invalidCredential(data: Record<string, unknown>) {
        return new APIError({
            msg: "Login inválido",
            status: 401,
            data,
        })
    }
}
