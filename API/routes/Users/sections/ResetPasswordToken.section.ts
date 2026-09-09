import crypto from "crypto"
import jwt from "jsonwebtoken"
import { enviromentManager } from "root/Utils/enviromentManager"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"

//  O token da recuperação de senha: **um JWT curto, sem tabela nova.**
//
//  É o mesmo padrão do `ChallengeToken` da biometria (`UsersAuth/sections/WebAuthnChallenge`),
//  que já resolve este problema no projeto: provar que um dado veio da API e não do cliente,
//  sem guardar estado entre duas requisições. Assinar, e não sortear uma string e guardá-la,
//  é o que dispensa a tabela — e com ela a rotina de limpeza de tokens vencidos, para um fluxo
//  que roda três vezes por ano.
//
//  **Uso único por construção, e é aqui que está a ideia.** O token carrega uma impressão
//  digital da senha atual: trocar a senha muda o hash, a impressão deixa de casar e o token
//  morre no primeiro uso, sozinho. Nenhuma linha em banco, nenhuma lista de revogados.
//
//  O `type` dentro do token é obrigatório pela mesma razão que na biometria: um token de outra
//  finalidade — um desafio de WebAuthn, uma futura confirmação de e-mail — não pode ser gasto
//  aqui.
class Controller {

    //  Curta, e não as 24h da sessão: o token é a credencial de troca de senha, e o intervalo
    //  entre pedir e clicar é de minutos. Vale o tempo de achar o e-mail na caixa de entrada.
    private readonly expiresIn = "30m"

    private readonly type = "reset"

    public sign(user: Database.Users) {
        return jwt.sign(
            { IdUser: user.IdUser, type: this.type, fingerprint: this.fingerprint(user.Password) },
            enviromentManager.getEnv("JWT_SECRET"),
            { expiresIn: this.expiresIn },
        )
    }

    /**
     * Confere o token contra o usuário que ele aponta, e devolve o payload.
     *
     * **Uma `msg` só para todos os motivos** — assinatura errada, expirado, tipo errado,
     * senha já trocada. A tela mostra "peça outro link" em qualquer um dos casos, e distinguir
     * só ajudaria quem está testando tokens.
     */
    public verify(token: string, user: Database.Users | undefined) {
        let payload: ResetTokenPayload

        try {
            payload = jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as ResetTokenPayload
        } catch (error) {
            throw this.invalid()
        }

        //  Um desafio de biometria é assinado com o MESMO JWT_SECRET: sem esta linha ele
        //  passaria na verificação acima e viraria uma troca de senha.
        if (payload.type !== this.type) {
            throw this.invalid({ type: payload.type })
        }

        if (!user || user.IdUser !== payload.IdUser) {
            throw this.invalid()
        }

        //  O uso único. Depois da primeira troca o hash é outro, e o mesmo link — que ficou na
        //  caixa de entrada, e pode ter passado por um encaminhamento — deixa de valer.
        if (payload.fingerprint !== this.fingerprint(user.Password)) {
            throw this.invalid()
        }

        return payload
    }

    /**
     * O que vai dentro do token no lugar do hash: um **sha256 do hash**, truncado.
     *
     * Truncado do hash de um hash, e não um pedaço do bcrypt em si, porque o payload de um JWT
     * é base64 — qualquer um que tenha o token lê o conteúdo em claro. Um pedaço do bcrypt ali
     * seria material da credencial viajando por e-mail; o resumo tem a única propriedade de
     * que este arquivo precisa: muda quando a senha muda.
     */
    private fingerprint(passwordHash: string) {
        return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16)
    }

    private invalid(data?: any) {
        return new APIError({
            msg: "Link de recuperação inválido ou expirado. Peça um novo.",
            status: 406,
            data,
        })
    }
}

export interface ResetTokenPayload {
    IdUser: number
    type: "reset"
    fingerprint: string
}

export const ResetPasswordToken = new Controller()
