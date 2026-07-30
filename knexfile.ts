import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

const config: { [key: string]: Knex.Config } = {
	development: {
		client: "mysql",
		connection: {
			host: process.env.DB_HOST,
			user: process.env.DB_LOGIN,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_SCHEMA,
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined
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
