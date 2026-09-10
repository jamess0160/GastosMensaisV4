import { NextFunction, Request, Response } from "express"
import { Utils } from "./Utils"
import { APIError, Logs } from "./Logs"
import { logFlags } from "./logFlags"
import { isProduction } from "./environment"
import { Users_controller } from "root/routes/Users/Users.controller"

type ExpressPromise = (req: Request, res: Response, next: NextFunction) => unknown

//  Modulo de async handler
export function AsyncHandler(routeFunction: ExpressPromise, requireToken = true) {

    return async function (req: Request, res: Response, next: NextFunction) {

        try {

            if (requireToken && Users_controller.acessMiddleware(req, res) === false) {
                return
            }

            let result = routeFunction(req, res, next)

            if (result instanceof Promise) {
                await result
            }

        } catch (error: any) {

            //  O stack no console é a conveniência de quem está com o servidor aberto na
            //  frente; em produção ele vira o objeto de erro inteiro no stdout do container,
            //  onde ninguém está olhando e o que estiver dentro dele fica gravado.
            if (!isProduction()) {
                console.log(error)
            }

            if (logFlags.routeErrors && (error instanceof APIError && error.status !== 401)) {
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