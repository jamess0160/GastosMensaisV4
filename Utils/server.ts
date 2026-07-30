import express from 'express'
import cors from 'cors'
import { modules } from 'root/modules/modules'

class Server {

    readonly app = express()

    private appLoaded = false

    constructor() {
        this.middlewares()
        this.app.use(modules)

        this.appLoaded = true
    }

    private middlewares() {
        this.app.use(express.json())
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