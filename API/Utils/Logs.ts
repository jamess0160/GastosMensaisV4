import winston from "winston";
import 'winston-daily-rotate-file'
import { isProduction } from "./environment"

const caminhoLogs = `${process.cwd()}/Logs/`

const RotineLoggers: Record<string, winston.Logger> = {}

const Loggers: Partial<Record<KeyLogs, winston.Logger>> = {}

//  **O ambiente decide para onde o log vai; o que vai dentro dele não muda.**
//
//  Em produção isto roda dentro de um container, e arquivo em disco ali é a camada de escrita
//  da imagem: o log some no próximo `docker compose up` — justamente o momento em que alguém
//  vai querer ler o que aconteceu antes. Some junto o `maxFiles: 7`, que não tem quem o cumpra
//  se ninguém nunca lê o volume, e o caminho, que depende de `process.cwd()` e muda com o
//  `WORKDIR`. Então em produção o transporte é o `Console`: o stdout é o que o driver de log do
//  Docker captura, e rotação e teto de tamanho viram configuração do orquestrador — fora da
//  aplicação, que é onde essa decisão pertence.
//
//  Fora de produção nada muda: o `DailyRotateFile` de sempre, porque `Logs/` na máquina de
//  desenvolvimento é útil e não custa nada.
//
//  O ambiente é perguntado pelo `isProduction()` e por mais nada — o mesmo ponto único que
//  decide o `secure` do cookie e o stack de erro do `AsyncHandler`; um segundo jeito de
//  perguntar é um jeito de os dois discordarem. E é perguntado **aqui dentro**, na criação de
//  cada logger (preguiçosa, no primeiro log de cada tipo), não no import: em produção o
//  `DailyRotateFile` nunca chega a ser construído, e é a construção dele que criaria a pasta
//  `Logs/` que ninguém vai ler.
//
//  As chaves do JSON são as mesmas nos dois (`level`, `timestamp`, `message`). A única
//  diferença é a indentação, e ela não é cosmética: um driver de log lê **uma linha por
//  evento**, então o JSON indentado que é confortável de ler no arquivo viraria, no stdout,
//  uma dúzia de registros soltos sem nível e sem timestamp.
function createLogger(path: string, level: string = path) {
    const producao = isProduction()

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
                }, null, producao ? 0 : 2)
            })
        ),
        transports: producao
            ? new winston.transports.Console({ level: level })
            : new winston.transports.DailyRotateFile({ filename: `${caminhoLogs}/${path}/%DATE%.${level}.log`, level: level, datePattern: "YYYY-MM-DD", maxFiles: 7 })
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