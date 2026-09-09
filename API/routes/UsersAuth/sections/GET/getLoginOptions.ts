import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { APIError } from "root/Utils/Logs"
import { UsersAuth_model } from "../../UsersAuth.model"
import { WebAuthnChallenge } from "../WebAuthnChallenge.section"
import { WebAuthnConfig } from "../WebAuthnConfig.section"

//  Passo 1 do login por biometria. Rota pública — é justamente o caminho de quem ainda não
//  tem token. Quem diz o que oferecer é o DeviceKey guardado no aparelho.
//
//  O desafio não fixa usuário: se duas pessoas registraram a digital no mesmo aparelho, as
//  duas credenciais entram no allowCredentials e quem escolhe é o autenticador. O usuário só
//  é resolvido no authenticate, pelo CredentialId que voltar assinado.
export class GetLoginOptions {
    public async run(deviceKey: string) {
        let credentials = await UsersAuth_model.getByDeviceKey(deviceKey)

        if (!credentials.length) {
            throw new APIError({
                msg: "Nenhuma credencial biométrica registrada neste dispositivo.",
                status: 406,
            })
        }

        let options = await generateAuthenticationOptions({
            rpID: WebAuthnConfig.rpID,
            timeout: 60000,
            allowCredentials: credentials.map((credential) => ({ id: credential.CredentialId })),
            userVerification: "preferred",
        })

        return {
            options,
            ChallengeToken: WebAuthnChallenge.sign({ challenge: options.challenge, type: "login" }),
        }
    }
}
