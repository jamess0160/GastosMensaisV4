import knex from 'knex'
import { Utils } from 'root/Utils/Utils'
import { JoinActives } from './section/JoinActives'
import { ReturnId } from './section/returnId'

Utils.configEnv()

knex.QueryBuilder.extend("joinActives", async function (params: any) {
    let data = await this as any
    return new JoinActives(this.client).run(data, params)
})

knex.QueryBuilder.extend("returnId", function (IdKey: string) {
    return new ReturnId().run(this, IdKey)
})

export const appKnex = knex