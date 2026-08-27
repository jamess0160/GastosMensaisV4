import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { enviromentManager } from 'root/Utils/enviromentManager'
import { Utils } from 'root/Utils/Utils'

Utils.configEnv()

class Controller {

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