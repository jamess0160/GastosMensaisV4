//  O TestEnv precisa vir antes de qualquer import do app: é ele que carrega o .env.test
import { TestEnv } from "./TestEnv"
import path from "path"
import { DBTypes, KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"

const migrationConfig = {
    directory: path.resolve(process.cwd(), "migrations"),
    tableName: "knex_migrations",
    loadExtensions: [".ts"],
}

//  Acesso direto ao banco de teste: preparo do schema, limpeza entre suítes e asserts que
//  precisam olhar a linha gravada, não só a resposta HTTP.
export namespace TestDatabase {

    export function connection() {
        return KnexConnection
    }

    //  Deixa o schema na última migration, sem apagar nada
    export async function migrate() {
        TestEnv.assertTestDatabase()

        await KnexConnection.migrate.latest(migrationConfig)
    }

    //  Derruba tudo e sobe de novo: garante schema novo e os seeds que moram nas migrations
    //  (as categorias pré-definidas, por exemplo). Roda uma vez por execução, no globalSetup.
    export async function reset() {
        TestEnv.assertTestDatabase()

        await KnexConnection.migrate.rollback(migrationConfig, true)
        await KnexConnection.migrate.latest(migrationConfig)
    }

    //  Limpa as tabelas informadas (ou todas, se nenhuma for passada) e zera as sequences dos ids.
    //  CASCADE: truncar Users leva junto tudo que depende dele.
    export async function truncate(tables?: Array<keyof DBTypes>) {
        TestEnv.assertTestDatabase()

        let list: string[] = tables?.length ? tables as string[] : await getTables()

        if (!list.length) return

        await KnexConnection.raw(`truncate table ${list.map((table) => `"${table}"`).join(", ")} restart identity cascade`)
    }

    export async function getTables() {
        let result = await KnexConnection.raw(`
            select tablename from pg_tables
            where schemaname = 'public' and tablename not like 'knex_%'
        `) as { rows: { tablename: string }[] }

        return result.rows.map((row) => row.tablename)
    }

    //  Sem isso o pool do knex segura o processo do jest aberto no fim da suíte
    export async function disconnect() {
        await KnexConnection.destroy()
    }
}
