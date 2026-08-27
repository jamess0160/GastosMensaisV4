import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { enviromentManager } from 'root/Utils/enviromentManager'
import { Logs } from 'root/Utils/Logs'
import { Utils } from 'root/Utils/Utils'
import { Users_model } from '../Users.model'

Utils.configEnv()

class Controller {

    //  Fim de linha de todo login, seja por senha ou por biometria: é o único ponto que
    //  transforma uma credencial já validada em sessão. Quem valida a credencial não emite
    //  token por conta própria, para os dois caminhos não divergirem no que gravam.
    async startSession(res: Response, IdUser: number) {
        this.setTokenCookie(res, IdUser)

        await this.updateLastLogin(IdUser)
    }

    //  O LastLogin é telemetria: falhar aqui não pode derrubar um login que já foi aprovado.
    private async updateLastLogin(IdUser: number) {
        try {
            await Users_model.update(IdUser, { LastLogin: new Date() })
        } catch (error) {
            Logs.handleError("Ocorreu um erro ao atualizar o LastLogin", error, { IdUser })
        }
    }

    generateToken(userId: number): string {
        return jwt.sign({ id: userId }, enviromentManager.getEnv("JWT_SECRET"), { expiresIn: "24h" })
    }

    verifyJwtToken(token: string): null | { id: number } {
        try {
            return jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as { id: number }
        } catch (error: any) {
            return null
        }
    }

    setTokenCookie(res: Response, userId: number): void {
        const token = this.generateToken(userId)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        })
    }

    clearTokenCookie(res: Response): void {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        })
    }

}

export const AcessControl = new Controller()