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
    // Identidade e acesso
    Users: Database.Users
    Workspaces: Database.Workspaces
    WorkspaceMembers: Database.WorkspaceMembers
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

    // Plataforma
    UserDevices: Database.UserDevices
    Notifications: Database.Notifications
    Plans: Database.Plans
    Subscriptions: Database.Subscriptions
}