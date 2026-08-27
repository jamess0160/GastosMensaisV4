import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server"

export namespace UsersAuthNamespace {

    /** O que o autenticador devolve depende do navegador/SO: o corpo é repassado inteiro
     *  para a lib verificar. O schema Joi só garante o envelope. */
    export interface RegisterPayload {
        ChallengeToken: string
        Response: RegistrationResponseJSON
        /** Ausente na primeira vez: a API gera e devolve para o cliente guardar. */
        DeviceKey?: string
    }

    export interface AuthenticatePayload {
        ChallengeToken: string
        Response: AuthenticationResponseJSON
    }

    export interface SkipDevicePayload {
        DeviceKey?: string
    }

    export type ChallengeType = "register" | "login"

    export interface ChallengePayload {
        challenge: string
        type: ChallengeType
        /** Só no fluxo de registro, que já roda autenticado. */
        IdUser?: number
    }

    /** true = tem biometria neste aparelho, false = já recusou, null = nunca foi perguntado. */
    export type UseAuth = boolean | null
}
