import { Knex } from "knex"
import { Database } from "root/Utils/database"
import { appKnex } from "./AppKnex"
import { TransactionEvents } from "./section/transactionEvents"
import { enviromentManager } from "root/Utils/enviromentManager"

export const KnexConnection = appKnex({
    client: enviromentManager.getEnv("DB_CLIENT"),
    connection: {
        host: enviromentManager.getEnv("DB_HOST"),
        user: enviromentManager.getEnv("DB_LOGIN"),
        password: enviromentManager.getEnv("DB_PASSWORD", true),
        database: enviromentManager.getEnv("DB_SCHEMA"),
        port: enviromentManager.getEnv("DB_PORT", true) ? parseInt(enviromentManager.getEnv("DB_PORT", true)) : undefined
    },
})

//  O tx é Knex.Transaction (e não o Knex solto) porque é esse o tipo que o .transacting()
//  dos models aceita: sem isso cada query dentro da transaction precisaria de um cast.
export async function KnexTransaction<T>(fn: (tx: Knex.Transaction, events: TransactionEvents) => Promise<T>): Promise<T> {
    let events = new TransactionEvents()

    let result = await KnexConnection.transaction((tx) => fn(tx, events))

    await events.fireOnEnd()

    return result
}

export type KnexConnectionType = typeof KnexConnection

export interface DBTypes {
    // Identidade e acesso
    Users: Database.Users
    Workspaces: Database.Workspaces
    WorkspaceMembers: Database.WorkspaceMembers
    WorkspaceInvites: Database.WorkspaceInvites
    UsersAuth: Database.UsersAuth
    TrustedDevices: Database.TrustedDevices

    // Contas e formas de pagamento
    Accounts: Database.Accounts
    PaymentMethods: Database.PaymentMethods

    // Categorias e orcamento
    Categories: Database.Categories
    Budgets: Database.Budgets
    BudgetPeriods: Database.BudgetPeriods
    Persons: Database.Persons

    // Entradas
    Inflows: Database.Inflows
    InflowPersons: Database.InflowPersons

    // Gastos
    Expenses: Database.Expenses
    ExpensePayments: Database.ExpensePayments
    ExpensePersons: Database.ExpensePersons
    Tags: Database.Tags
    ExpenseTags: Database.ExpenseTags

    // Sistema
    RotineRuns: Database.RotineRuns

    // Plataforma
    UserDevices: Database.UserDevices
    Notifications: Database.Notifications
    Plans: Database.Plans
    Subscriptions: Database.Subscriptions
}