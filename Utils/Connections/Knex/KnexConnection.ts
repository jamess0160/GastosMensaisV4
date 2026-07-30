import { Database } from "root/Utils/database"
import { appKnex } from "./AppKnex"
import { TransactionEvents } from "./section/transactionEvents"
import { criptManager } from "root/Utils/criptManager"

export const KnexConnection = appKnex({
    client: criptManager.getEnv("DB_CLIENT"),
    connection: {
        host: criptManager.getEnv("DB_HOST", true),
        user: criptManager.getEnv("DB_LOGIN", true),
        password: criptManager.getEnv("DB_PASSWORD", true, true),
        database: criptManager.getEnv("DB_SCHEMA", true),
        port: criptManager.getEnv("DB_PORT", true, true) ? parseInt(criptManager.getEnv("DB_PORT", true, true)) : undefined
    },
})

export async function KnexTransaction(fn: (tx: KnexConnectionType, events: TransactionEvents) => Promise<unknown>) {
    let events = new TransactionEvents()

    let result = await KnexConnection.transaction((tx) => fn(tx, events))

    await events.fireOnEnd()

    return result
}

export type KnexConnectionType = typeof KnexConnection

export interface DBTypes {
    Users: Database.Users
    UserGroupTypes: Database.UserGroupTypes
    UserGroupNames: Database.UserGroupNames
    UserInGroups: Database.UserInGroups
    Companys: Database.Companys
    SystemParams: Database.SystemParams
    Plants: Database.Plants
    PasswordRecoverys: Database.PasswordRecoverys
    Permissions: Database.Permissions
}