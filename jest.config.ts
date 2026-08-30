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

    //  Importar o app em memória deixa handles vivos que nunca fecham sozinhos (o socket.io do
    //  Utils/socket.ts e o setInterval do memoryLog do cache). Sem isso o jest termina os testes
    //  e fica pendurado esperando o event loop esvaziar.
    forceExit: true,

    clearMocks: true,
    verbose: true,
}

export default config
