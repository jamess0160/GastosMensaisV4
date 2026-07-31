import type { Knex } from "knex";
import dotenv from "dotenv";
import { criptManager } from "./Utils/criptManager";

dotenv.config();

const config: { [key: string]: Knex.Config } = {
	development: {
		client: criptManager.getEnv("DB_CLIENT"),
		connection: {
			host: criptManager.getEnv("DB_HOST", true),
			user: criptManager.getEnv("DB_LOGIN", true),
			password: criptManager.getEnv("DB_PASSWORD", true, true),
			database: criptManager.getEnv("DB_SCHEMA", true),
			port: criptManager.getEnv("DB_PORT", true, true) ? parseInt(criptManager.getEnv("DB_PORT", true, true)) : undefined
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
