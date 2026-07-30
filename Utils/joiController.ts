import { Request, Response, NextFunction } from "express"
import { APIError } from "root/Utils/Logs"
import { Schema } from "joi"
import { AsyncHandler } from "./AsyncHandler"

class JoiController {
    public validateBody(schema: Schema) {
        return AsyncHandler((req: Request, res: Response, next: NextFunction) => {
            let { error, value } = schema.validate(req.body, { abortEarly: false })

            if (error) {
                throw new APIError({
                    msg: "Dados de entrada inválidos.",
                    status: 406,
                    data: {
                        details: error.details
                    }
                })
            }

            req.body = value
            next()
        }, false)
    }

    public validateParams(schema: Schema) {
        return AsyncHandler((req: Request, res: Response, next: NextFunction) => {
            let { error, value } = schema.validate(req.params, { abortEarly: false })

            if (error) {
                throw new APIError({
                    msg: "Parâmetros inválidos na URL.",
                    status: 406,
                    data: {
                        details: error.details
                    }
                })
            }

            req.params = value
            next()
        }, false)
    }

    public validateQuery(schema: Schema) {
        return AsyncHandler((req: Request, res: Response, next: NextFunction) => {
            let { error, value } = schema.validate(req.query, { abortEarly: false })

            if (error) {
                throw new APIError({
                    msg: "Parâmetros inválidos na Query.",
                    status: 406,
                    data: {
                        details: error.details
                    }
                })
            }

            req.query = value
            next()
        }, false)
    }
}

export const joiController = new JoiController()
