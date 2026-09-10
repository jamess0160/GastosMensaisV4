import winston from "winston";
import 'winston-daily-rotate-file'

const caminhoLogs = `${process.cwd()}/Logs/`

const RotineLoggers: Record<string, winston.Logger> = {}

const Loggers: Partial<Record<KeyLogs, winston.Logger>> = {}

function createLogger(path: string, level: string = path) {
    return winston.createLogger({
        level: level,
        levels: { [level]: 0 },
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format.printf((info) => {
                return JSON.stringify({
                    level: info.level,
                    timestamp: new Date(info.timestamp).toLocaleString("pt-br"),
                    message: JSON.parse(info.message),
                }, null, 2)
            })
        ),
        transports: new winston.transports.DailyRotateFile({ filename: `${caminhoLogs}/${path}/%DATE%.${level}.log`, level: level, datePattern: "YYYY-MM-DD", maxFiles: 7 })
    })
}

// Modulo de logs, com funções para ler e escrever nos logs, gerenciamento de fila de log
export namespace Logs {

    export function insertLog(newLog: Log, tipo: KeyLogs = "info") {
        let logger = Loggers[tipo]

        if (!logger) {
            logger = createLogger(tipo)
            Loggers[tipo] = logger
        }

        logger.log({
            level: tipo,
            message: JSON.stringify(newLog)
        })
    }

    export function insertRotineLog(newLog: Log, name: string) {

        let key = `rotines/${name}`

        if (!RotineLoggers[key]) {
            RotineLoggers[key] = createLogger(key, name)
        }

        RotineLoggers[key].log({
            level: name,
            message: JSON.stringify(newLog)
        })
    }

    export function handleError(msg: string, error: any, data?: any, options?: HandleErrorOptions) {
        let type: KeyLogs = error instanceof APIError && error.status === 406 ? "userError" : "error"

        Logs.insertLog({
            msg: msg,
            errorMessage: error.toString(),
            stack: error.stack?.split("\n"),
            fullError: error,
            data: data,
        }, options?.checkUserError !== false ? type : "error")
    }
}

export type KeyLogs = "info" | "error" | "userError" | "untracked" | "telemetry"

export interface Log {
    msg: string
    rota?: string
    methodo?: string
    IdUser?: number
    stack?: string[]
    data?: any
    fullError?: any
    errorMessage?: string
}

interface HandleErrorOptions {
    checkUserError: boolean
}

export class APIError {
    msg: string
    status: number
    data: any

    constructor(options: BTIErrorOptions) {
        this.msg = options.msg
        this.status = options.status
        this.data = options.data
    }
}

interface BTIErrorOptions {
    msg: string,
    status: number,
    data?: any
}