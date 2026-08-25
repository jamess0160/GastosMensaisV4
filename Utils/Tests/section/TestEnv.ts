import { Utils } from "root/Utils/Utils"

//  Este arquivo roda no setupFiles do jest, antes de qualquer import da aplicação.
//  Os módulos do app (criptManager, AppKnex, AcessControl) chamam Utils.configEnv() no
//  momento do import, então o ambiente precisa estar pronto antes disso.
process.env.NODE_ENV = "test"

//  Mesma função que o app usa: .env como base e .env.test por cima. O servidor levantado
//  para o modo end to end (NODE_ENV=test npx tsx index.ts) carrega exatamente o mesmo par.
Utils.configEnv()

export namespace TestEnv {

    //  Quando preenchida, os testes deixam de subir o app em memória e passam a bater em um
    //  servidor real (modo end to end). Pode vir do .env.test ou da linha de comando.
    export function getBaseUrl() {
        return process.env.TEST_BASE_URL || ""
    }

    export function isE2E() {
        return getBaseUrl() !== ""
    }

    export function getDatabaseName() {
        //  import tardio: o criptManager lê o process.env no import, precisa vir depois do dotenv
        const { criptManager } = require("root/Utils/criptManager") as typeof import("root/Utils/criptManager")

        return criptManager.getEnv("DB_SCHEMA", true)
    }

    //  Trava de segurança: migrate e truncate apagam dados, então só rodam em um banco cujo
    //  nome tenha "test". Sem isso um .env.test mal configurado derruba o banco de desenvolvimento.
    export function assertTestDatabase() {
        let database = getDatabaseName()

        if (process.env.TEST_DB_UNSAFE === "true") {
            return database
        }

        if (!/test/i.test(database)) {
            throw new Error(
                `O banco "${database}" não parece ser de teste. Aponte o DB_SCHEMA do .env.test para um banco dedicado ` +
                `(ex: gastos_mensais_v4_test) ou defina TEST_DB_UNSAFE=true se essa é mesmo a intenção.`
            )
        }

        return database
    }
}
