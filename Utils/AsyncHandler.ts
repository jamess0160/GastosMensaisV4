import { NextFunction, Request, Response } from "express"
import { Utils } from "./Utils"
import { APIError, Logs } from "./Logs"
import { Base_Users_controller } from "root/routes/Users/Users.controller"

type ExpressPromise = (req: Request, res: Response, next: NextFunction) => unknown

//  Modulo de async handler
export function AsyncHandler(routeFunction: ExpressPromise, requireToken = true) {

    return async function (req: Request, res: Response, next: NextFunction) {
        let constants = await Utils.getConstants()

        try {

            if (requireToken && Base_Users_controller.acessMiddleware(req, res) === false) {
                return
            }

            let result = routeFunction(req, res, next)

            if (result instanceof Promise) {
                await result
            }

        } catch (error: any) {
            if (constants.logs.routeErros) {
                Logs.handleError(`Ocorreu um erro na rota ${req.originalUrl}`, error, {
                    rota: req.originalUrl,
                    methodo: req.method,
                    IdUser: res.locals.IdUser,
                    data: req.body,
                })
            }

            if (res.headersSent) {
                return
            }

            if (error instanceof APIError) {
                res.status(error.status).json(error)
                return
            }

            // Retorna a requisição para o cliente
            res.sendStatus(500)
        }
    }
}