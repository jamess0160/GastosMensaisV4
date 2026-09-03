import { NextFunction, Request, Response } from "express"
import { Utils } from "./Utils"
import { APIError, Logs } from "./Logs"
import { Users_controller } from "root/routes/Users/Users.controller"

type ExpressPromise = (req: Request, res: Response, next: NextFunction) => unknown

//  Modulo de async handler
export function AsyncHandler(routeFunction: ExpressPromise, requireToken = true) {

    return async function (req: Request, res: Response, next: NextFunction) {
        let constants = await Utils.getConstants()

        try {

            if (requireToken && Users_controller.acessMiddleware(req, res) === false) {
                return
            }

            let result = routeFunction(req, res, next)

            if (result instanceof Promise) {
                await result
            }

        } catch (error: any) {

            if (process.env.PROD !== "true") {
                console.log(error)
            }

            if (constants.logs.routeErros && (error instanceof APIError && error.status !== 401)) {
                Logs.handleError(`Ocorreu um erro na rota ${req.originalUrl}`, error, {
                    rota: req.originalUrl,
                    methodo: req.method,
                    IdUser: res.locals.IdUser,
                    //  O body de cadastro/login carrega senha: nada de gravar isso no log
                    data: Utils.redactSensitive(req.body),
                })
            }

            if (res.headersSent) {
                return
            }

            if (error instanceof APIError) {
                res.status(error.status).json({
                    msg: error.msg
                })
                return
            }

            // Retorna a requisição para o cliente
            res.sendStatus(500)
        }
    }
}