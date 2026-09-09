import { verifyRegistrationResponse } from "@simplewebauthn/server"
import { APIError } from "root/Utils/Logs"
import { TrustedDevices_model } from "../../TrustedDevices.model"
import { UsersAuth_model } from "../../UsersAuth.model"
import { DeviceKey } from "../DeviceKey.section"
import { UsersAuthNamespace } from "../types"
import { WebAuthnChallenge } from "../WebAuthnChallenge.section"
import { WebAuthnConfig } from "../WebAuthnConfig.section"

//  Passo 2 do cadastro da biometria: confere a assinatura e guarda a chave pública.
export class Register {
    public async run(IdUser: number, body: UsersAuthNamespace.RegisterPayload) {
        let challenge = WebAuthnChallenge.verify(body.ChallengeToken, "register")

        //  O desafio é emitido para um usuário específico. Sem esta conferência, um token
        //  válido pego de outra conta serviria para pendurar uma passkey na conta do atacante
        //  — ou na da vítima, o que é pior.
        if (challenge.IdUser !== IdUser) {
            throw new APIError({
                msg: "Desafio inválido ou expirado. Tente novamente.",
                status: 406,
                data: { IdUser, challengeIdUser: challenge.IdUser },
            })
        }

        let verification = await verifyRegistrationResponse({
            response: body.Response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: WebAuthnConfig.origins,
            expectedRPID: WebAuthnConfig.rpID,
        }).catch((error) => {
            //  A lib estoura com a razão técnica da recusa; ela vale no log, não na resposta.
            throw new APIError({
                msg: "Não foi possível validar a biometria.",
                status: 406,
                data: { IdUser, reason: error?.message },
            })
        })

        if (!verification.verified || !verification.registrationInfo) {
            throw new APIError({
                msg: "Não foi possível validar a biometria.",
                status: 406,
                data: { IdUser },
            })
        }

        return await this.persist(IdUser, verification.registrationInfo.credential, body.DeviceKey)
    }

    private async persist(IdUser: number, credential: { id: string, publicKey: Uint8Array, counter: number }, currentDeviceKey?: string) {
        let deviceKey = currentDeviceKey || DeviceKey.generate()

        await UsersAuth_model.create({
            IdUser,
            CredentialId: credential.id,
            //  bytea no Postgres: a chave pública é COSE binário, não texto.
            PublicKey: Buffer.from(credential.publicKey),
            Counter: credential.counter,
            DeviceKey: deviceKey,
        })

        //  Registrar biometria desfaz o "não quero" anterior neste aparelho, senão o
        //  checkDevice ficaria com os dois estados ao mesmo tempo.
        await TrustedDevices_model.deleteByUserAndDevice(IdUser, deviceKey)

        return { verified: true, DeviceKey: deviceKey }
    }
}
