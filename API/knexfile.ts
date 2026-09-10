import path from "path";
import type { Knex } from "knex";
import { enviromentManager } from "./Utils/enviromentManager";

//  **Não há `dotenv.config()` aqui, e a ausência é a correção.** O import do
//  `enviromentManager` já chama `Utils.configEnv()`, que lê o `.env` e sobrepõe o `.env.test`
//  quando `NODE_ENV=test` — exatamente o mesmo carregamento que a API faz. O
//  `dotenv.config()` que existia neste arquivo rodava *depois* disso (imports são içados),
//  lia só o `.env` e não mudava nada — mas dava a impressão de que o CLI carregava o ambiente
//  por conta própria, e um `NODE_ENV=test npx knex migrate:latest` apontaria para o banco de
//  desenvolvimento se ele fosse a única fonte.
const config: Knex.Config = {
	client: enviromentManager.getEnv("DB_CLIENT"),
	connection: {
		host: enviromentManager.getEnv("DB_HOST"),
		user: enviromentManager.getEnv("DB_LOGIN"),
		password: enviromentManager.getEnv("DB_PASSWORD", true),
		database: enviromentManager.getEnv("DB_SCHEMA"),
		port: enviromentManager.getEnv("DB_PORT", true) ? parseInt(enviromentManager.getEnv("DB_PORT", true)) : undefined
	},
	pool: {
		min: 2,
		max: 10
	},
	migrations: {
		//  Caminho absoluto a partir deste arquivo, não `"./migrations"`: o mesmo config é
		//  lido de dois lugares — daqui (`knexfile.ts`, pelo ts-node) e de `build/knexfile.js`
		//  dentro da imagem —, e cada um tem a sua pasta de migrations ao lado. Relativo ao
		//  cwd, o comando de produção acharia os `.ts` da raiz e morreria tentando carregá-los
		//  sem ts-node.
		directory: path.join(__dirname, "migrations"),
		tableName: "knex_migrations"
	}
};

//  O CLI do knex escolhe a chave pelo `NODE_ENV`, com `development` como padrão. Exportar só
//  `development` era o primeiro deploy morrendo antes da primeira requisição: com
//  `NODE_ENV=production` ele procura `production`, não acha, e falha.
//
//  **Um objeto e três referências, nunca três blocos copiados** — três cópias divergem no dia
//  em que alguém acrescenta uma opção de pool. Qual banco é qual já é resposta do ambiente
//  (o `.env`, o `.env.test` por cima dele, ou o orquestrador do deploy), e não deste arquivo.
const environments: { [key: string]: Knex.Config } = {
	development: config,
	test: config,
	production: config
};

module.exports = environments;
