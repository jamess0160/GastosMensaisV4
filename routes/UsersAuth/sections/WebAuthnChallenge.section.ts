import jwt from "jsonwebtoken"
import { enviromentManager } from "root/Utils/enviromentManager"
import { APIError } from "root/Utils/Logs"
import { UsersAuthNamespace } from "./types"

//  O desafio do WebAuthn precisa sobreviver entre o GET que gera as options e o POST que traz
//  a assinatura. O V3 guardava na sessão em cookie; aqui a API é stateless (o acessMiddleware
//  lê o header, não o cookie), então o desafio volta para o cliente como um JWT curto assinado
//  com o mesmo JWT_SECRET e é devolvido no corpo do POST.
//
//  Assinar, e não só ecoar, é o que sustenta a garantia: um desafio escolhido pelo cliente
//  deixaria de ser aleatório e abriria replay. O type vai dentro do token para um desafio de
//  registro não ser reaproveitado como desafio de login.
class Controller {

    //  Curto de propósito: é o tempo entre pedir a digital e o usuário encostar o dedo.
    private readonly expiresIn = "5m"

    public sign(payload: UsersAuthNamespace.ChallengePayload) {
        return jwt.sign(payload, enviromentManager.getEnv("JWT_SECRET"), { expiresIn: this.expiresIn })
    }

    public verify(token: string, expectedType: UsersAuthNamespace.ChallengeType): UsersAuthNamespace.ChallengePayload {
        let payload: UsersAuthNamespace.ChallengePayload

        try {
            payload = jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as UsersAuthNamespace.ChallengePayload
        } catch (error) {
            throw new APIError({
                msg: "Desafio inválido ou expirado. Tente novamente.",
                status: 406,
            })
        }

        if (payload.type !== expectedType) {
            throw new APIError({
                msg: "Desafio inválido ou expirado. Tente novamente.",
                status: 406,
                data: { expectedType, type: payload.type },
            })
        }

        return payload
    }
}

export const WebAuthnChallenge = new Controller()
