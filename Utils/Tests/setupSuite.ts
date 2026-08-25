import { TestDatabase } from "./section/TestDatabase"

//  Roda em cada arquivo de teste (jest.config -> setupFilesAfterEnv).
//  Cada arquivo tem seu próprio registry de módulos e, portanto, seu próprio pool do knex:
//  sem o destroy o jest termina os testes e fica pendurado esperando as conexões.
afterAll(async () => {
    await TestDatabase.disconnect()
})
