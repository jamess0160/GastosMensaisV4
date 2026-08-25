//  Ordem importa: o TestEnv carrega o .env.test antes de o TestDatabase abrir a conexão
import { TestEnv } from "./section/TestEnv"
import { TestDatabase } from "./section/TestDatabase"

//  Roda uma única vez, antes de toda a suíte (jest.config -> globalSetup).
//  Recria o schema do zero para que a execução não dependa do estado deixado pela anterior,
//  e para que os seeds das migrations (categorias pré-definidas) estejam sempre lá.
export default async function globalSetup() {
    let database = TestEnv.assertTestDatabase()

    //  Útil quando o banco já está preparado e só se quer rodar as suítes de novo
    if (process.env.TEST_SKIP_MIGRATIONS === "true") {
        return
    }

    await TestDatabase.reset()
    await TestDatabase.disconnect()

    console.log(`\n[testes] banco "${database}" recriado${TestEnv.isE2E() ? ` | end to end contra ${TestEnv.getBaseUrl()}` : " | app em memória"}`)
}
