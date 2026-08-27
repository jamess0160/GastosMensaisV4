import knex from 'knex'
import { Utils } from 'root/Utils/Utils'
import { JoinTables } from './section/JoinTables'
import { ReturnId } from './section/returnId'
import { registerPgTypeParsers } from './section/pgTypeParsers'
import { enviromentManager } from 'root/Utils/enviromentManager'

Utils.configEnv()

registerPgTypeParsers(enviromentManager.getEnv("DB_CLIENT"))

knex.QueryBuilder.extend("joinTables", async function (params: any) {
    let data = await this as any
    return new JoinTables(this.client).run(data, params)
})

knex.QueryBuilder.extend("returnId", function (IdKey: string) {
    return new ReturnId().run(this, IdKey)
})

export const appKnex = knex
