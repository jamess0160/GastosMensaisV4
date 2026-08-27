import type { Knex } from "knex";
import dotenv from "dotenv";
import { enviromentManager } from "./Utils/enviromentManager";

dotenv.config();

const config: { [key: string]: Knex.Config } = {
	development: {
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
			directory: "./migrations",
			tableName: "knex_migrations"
		}
	}
};

module.exports = config;
