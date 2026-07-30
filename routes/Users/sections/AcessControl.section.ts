import jwt from 'jsonwebtoken'
import { criptManager } from 'root/Utils/criptManager'
import { Utils } from 'root/Utils/Utils'

Utils.configEnv()

export class class_Base_AcessControl {

    generateToken(userId: number): string {
        return jwt.sign({ id: userId }, criptManager.getEnv("JWT_SECRET", true), { expiresIn: "24h" })
    }

    verifyJwtToken(token: string): null | { id: number } {
        try {
            return jwt.verify(token, criptManager.getEnv("JWT_SECRET", true)) as { id: number }
        } catch (error: any) {
            return null
        }
    }
}

export const Base_AcessControl = new class_Base_AcessControl()