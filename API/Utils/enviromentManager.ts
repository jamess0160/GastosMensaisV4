import { Utils } from "./Utils"
import { APIError } from "./Logs"

Utils.configEnv()

class EnviromentManager {

    public getEnv(environmentKey: string, optional: boolean = false) {
        let environment = process.env[environmentKey]

        if (!environment) {

            if (optional === true) {
                return ""
            }

            //  Sem o valor: nunca inclua o conteúdo da variável no data, esse erro vai parar
            //  no log através do fullError do Logs.handleError
            throw new APIError({
                msg: `A variável de ambiente '${environmentKey}' não foi encontrada`,
                status: 500,
                data: { environmentKey }
            })
        }

        return environment
    }

}

export const enviromentManager = new EnviromentManager()
