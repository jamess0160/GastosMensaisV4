import { server } from "./Utils/server"
import { Logs } from "./Utils/Logs"
import { Utils } from "./Utils/Utils"
import { enviromentManager } from "./Utils/enviromentManager"
import { isTest } from "./Utils/environment"
import { KnexConnection } from "./Utils/Connections/Knex/KnexConnection"
import { Rotines } from "./rotines"
import { rotineEngine } from "./rotines/section/RotineEngine"

Utils.configEnv()

const port = enviromentManager.getEnv("PORT")

const httpServer = server.app.listen(port, () => {
    Logs.insertLog({ msg: "Api iniciada" })

    startRotines()

    console.log(new Date().toLocaleString('pt-br'))
    console.log(`Aplicação rodando em: http://localhost:${port}`)
})

//  **O motor só liga aqui, e só fora de teste.** O `npm run start:test` sobe a API contra o
//  banco de teste, e uma rotina disparando no meio da suíte muda o banco debaixo de um teste
//  que está rodando — é o mesmo problema que o `memoryLog.stop()` já teve que resolver, e que
//  custou uma falha aleatória para ser descoberto.
//
//  Ligar aqui, e não no import do motor, é o que mantém o app em memória do supertest livre de
//  rotina: ele importa `Utils/server`, nunca este arquivo.
function startRotines() {
    if (isTest()) {
        console.log("Rotinas desligadas: NODE_ENV=test")
        return
    }

    rotineEngine.register(...Rotines).start()

    console.log(`Rotinas ativas: ${Rotines.length}`)
}

//  ---------------------------------------------------------------------------------------
//  Encerramento
//  ---------------------------------------------------------------------------------------
//
//  `docker stop` manda `SIGTERM` e espera dez segundos antes do `SIGKILL`; o Ctrl+C do
//  terminal manda `SIGINT`. Sem nenhum handler, os dois caíam no comportamento padrão do
//  Node — morrer na hora — e três coisas quebravam no meio:
//
//  - requisições em voo, inclusive as que estão dentro de uma transaction;
//  - o pool do Knex, que morre sem `destroy()` e deixa conexões penduradas do lado do Postgres
//    até o timeout dele;
//  - o tick do motor de rotinas, e este é o caro: uma ocorrência reivindicada em `RotineRuns`
//    e interrompida antes do `FinishedAt` **não é reivindicada de novo** (é o que o
//    `unique(Name, ScheduledFor)` garante), então o mês fica sem fechar e o catch-up, que
//    existe justamente para cobrir uma queda, não cobre esta.
//
//  A ordem abaixo não é arbitrária, é a única que não cria trabalho enquanto se espera
//  trabalho terminar.
//
//  **A ocorrência órfã de antes disto continua órfã**, e tudo bem: as rotinas são convergentes
//  e o mês seguinte reprocessa. O que este handler impede é a criação de novas.
const shutdownTimeout = 10 * 1000

let shuttingDown = false

process.on("SIGTERM", () => { shutdown("SIGTERM") })
process.on("SIGINT", () => { shutdown("SIGINT") })

async function shutdown(signal: string) {
    //  O segundo Ctrl+C (ou o SIGTERM que chega junto) não pode reiniciar a sequência: seria
    //  um segundo `destroy()` no pool enquanto o primeiro ainda espera o servidor fechar.
    if (shuttingDown) {
        return
    }

    shuttingDown = true

    console.log(`Encerrando a API (${signal})...`)
    Logs.insertLog({ msg: "Encerrando a API", data: { signal } })

    //  **O teto.** Um encerramento travado é pior do que um abrupto: o `SIGKILL` chega no
    //  mesmo lugar dez segundos depois, sem log nenhum e sem ninguém saber o que segurou. O
    //  timer fica com ref de propósito — ele é o que mantém o processo vivo até uma das duas
    //  saídas acontecer — e é limpo no fim do caminho feliz.
    const forceExit = setTimeout(() => {
        console.error("Encerramento não terminou em 10s. Saindo à força.")
        process.exit(1)
    }, shutdownTimeout)

    try {
        //  1. O motor primeiro, para nenhum tick novo começar — e o `stop()` espera o tick que
        //     já estava rodando carimbar o `FinishedAt`.
        await rotineEngine.stop()

        //  2. O servidor HTTP: para de aceitar conexão nova e espera as requisições em voo. É
        //     um servidor só desde que o socket morreu (leva 7, etapa 4); com ele haveria uma
        //     segunda porta escutando, e um `close()` que esquece a outra é um processo que
        //     não morre.
        //
        //     `closeIdleConnections()` é o que faz esse fim de espera acontecer em produção:
        //     o nginx mantém conexões keep-alive ociosas com o upstream, e **uma conexão
        //     ociosa não é uma requisição em voo** — sem isto o `close()` esperaria por ela
        //     até o teto acima, em todo deploy.
        //
        //     Uma chamada só não basta, e isso foi medido: a conexão que carregava a
        //     requisição em voo não está ociosa no instante do `close()`, fica ociosa quando a
        //     resposta sai, e aí ninguém mais a varre — o encerramento ficava pendurado nela
        //     por três segundos, até o cliente desistir sozinho. A varredura repetida fecha
        //     cada conexão no momento em que ela deixa de ter uma requisição em cima.
        await new Promise<void>((resolve, reject) => {
            const dropIdle = setInterval(() => httpServer.closeIdleConnections(), 200)

            httpServer.close((error) => {
                clearInterval(dropIdle)

                return error ? reject(error) : resolve()
            })

            httpServer.closeIdleConnections()
        })

        //  3. Só agora o banco: fechar o pool antes do servidor deixaria a requisição em voo
        //     sem conexão, que é o mesmo corte no meio da transaction, com outro nome.
        await KnexConnection.destroy()

        console.log("API encerrada.")
        Logs.insertLog({ msg: "API encerrada", data: { signal } })
    } catch (error: any) {
        Logs.handleError("Ocorreu um erro no encerramento da API", error)
    } finally {
        clearTimeout(forceExit)
    }
}
