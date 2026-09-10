import { server } from "./Utils/server"
import { Logs } from "./Utils/Logs"
import { Utils } from "./Utils/Utils"
import { enviromentManager } from "./Utils/enviromentManager"
import { isTest } from "./Utils/environment"
import { Rotines } from "./rotines"
import { rotineEngine } from "./rotines/section/RotineEngine"

Utils.configEnv()

const port = enviromentManager.getEnv("PORT")

server.app.listen(port, () => {
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
