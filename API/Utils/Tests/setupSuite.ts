import { TestEnv } from "./section/TestEnv"
import { TestDatabase } from "./section/TestDatabase"

//  Roda em cada arquivo de teste (jest.config -> setupFilesAfterEach).
//  Cada arquivo tem seu próprio registry de módulos e, portanto, seu próprio pool do knex:
//  sem o destroy o jest termina os testes e fica pendurado esperando as conexões.
afterAll(async () => {
    stopBackgroundTimers()

    await TestDatabase.disconnect()
})

//  O intervalo de telemetria do cache dispara sozinho a cada minuto. Se ele cair depois que o
//  jest desmontou o ambiente deste arquivo, o import do winston já não existe e o erro aparece
//  **dentro de um teste qualquer do arquivo seguinte** — falha aleatória que não é do teste.
function stopBackgroundTimers() {
    //  require tardio e só fora do modo end to end: lá o app não é carregado neste processo, e
    //  importá-lo aqui subiria o servidor inteiro só para desligar um timer.
    if (TestEnv.isE2E()) return

    const { cacheEngine } = require("root/routes/Cache/sections/CacheEngine") as typeof import("root/routes/Cache/sections/CacheEngine")

    cacheEngine.stopMemoryLog()
}
