import type { Config } from "jest"

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",

    //  Um arquivo de teste por tabela/feature: routes/<Feature>/<Feature>.test.ts
    testMatch: ["**/*.test.ts"],

    //  Mesmo alias do tsconfig (root/*), que o jest não lê sozinho
    moduleNameMapper: {
        "^root/(.*)$": "<rootDir>/$1",
    },

    //  Ambiente antes de qualquer import do app
    setupFiles: ["<rootDir>/Utils/Tests/section/TestEnv.ts"],
    setupFilesAfterEnv: ["<rootDir>/Utils/Tests/setupSuite.ts"],

    //  Recria o banco de teste uma vez por execução
    globalSetup: "<rootDir>/Utils/Tests/globalSetup.ts",

    //  Os testes compartilham o mesmo banco: nada de paralelismo
    maxWorkers: 1,
    testTimeout: 30000,

    //  Importar o app em memória pode deixar handles vivos que não fecham sozinhos (o pool do
    //  nodemailer é o que sobrou). Sem isso o jest termina os testes e fica pendurado esperando
    //  o event loop esvaziar.
    forceExit: true,

    clearMocks: true,
    verbose: true,
}

export default config
