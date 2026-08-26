import crypto from "crypto"
import { Utils } from "./Utils"
import { APIError } from "./Logs"

Utils.configEnv()

class CriptManager {

    private readonly key = Buffer.from("0GWcp+9Y5MH6TkIIHQ9b9hDaFbztX/KfZTs/NVOHROw=", "base64")
    private readonly iv = Buffer.from("3PQcO/de5I5pH/hQ2ZXv4w==", "base64")

    public getEnv(environmentKey: string, isCrypt: boolean = false, optional: boolean = false) {
        try {
            let environment = process.env[environmentKey]

            if (!environment) {

                if (optional === true) {
                    return ""
                }

                throw new Error(`A variável de ambiente '${environmentKey}' não foi encontrada`)
            }

            if (!isCrypt || process.env.IS_CRIPTED === "false") {
                return environment
            }

            return this.decryptValue(environment)
        } catch (error) {
            throw new APIError({
                msg: `Ocorreu um erro ao buscar a variável ${environmentKey}`,
                status: 500,
                data: { error, value: process.env[environmentKey] }
            })
        }
    }

    public encript(value: string) {
        // @ts-ignore
        const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
        let encrypted = cipher.update(value, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }


    private decryptValue(value: string) {
        // @ts-ignore
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
        let decrypted = decipher.update(value, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

}

export const criptManager = new CriptManager()