import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { Routes } from 'root/routes'

class Server {

    readonly app = express()

    private appLoaded = false

    constructor() {
        this.middlewares()
        this.app.use(Routes)

        this.appLoaded = true
    }

    private middlewares() {
        this.app.use(express.json())
        //  Obrigatório: a sessão inteira (IdUser + IdWorkspace, assinados no token) chega pelo
        //  cookie e o acessMiddleware a lê de lá. O express escreve cookie sozinho (res.cookie)
        //  mas não lê — sem isto req.cookies não existe e toda rota protegida responde 401.
        this.app.use(cookieParser())
        this.app.use(cors())
    }

    public appLoad() {
        return new Promise((resolve) => {
            let interval = setInterval(() => {
                if (this.appLoaded) {
                    clearInterval(interval)
                    resolve(true)
                }
            })
        })
    }
}

export const server = new Server()