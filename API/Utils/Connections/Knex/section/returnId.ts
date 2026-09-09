import { Knex } from "knex";

export class ReturnId {
    public async run(query: Knex.QueryBuilder, IdKey: string): Promise<any> {

        const dbType = process.env.DB_CLIENT

        let sqlData = query.toSQL()

        if (sqlData.method !== "insert") {
            throw new Error("Não é possivel usar o metódo 'returnId' fora de um insert!")
        }

        let insertRows = this.countInsertRows(sqlData)

        if (insertRows > 1) {
            throw new Error("Não é possivel usar o metódo 'returnId' em inserts em lote!")
        }

        if (dbType !== "mysql" && dbType !== "mysql2") {
            let [result] = await query.returning("*")
            return result[IdKey]
        }

        let [InsertedId] = await query

        return InsertedId
    }

    private countInsertRows(sqlData: Knex.Sql) {

        let [, postValues] = sqlData.sql.split("values")

        return postValues.split("),").length;
    }
}

declare module 'knex' {
    namespace Knex {
        interface QueryBuilder<TRecord extends {}, TResult = any> {
            returnId(IdKey: string): Promise<number>
        }
    }
}