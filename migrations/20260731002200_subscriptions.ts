import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable("Plans", (table) => {
        table.increments("IdPlan").primary()
        table.string("Code", 100).notNullable()
        table.string("Name", 255).notNullable()
        table.decimal("PriceMonthly", 15, 2).notNullable().defaultTo(0)
        table.decimal("PriceYearly", 15, 2).notNullable().defaultTo(0)
        table.jsonb("Features").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.unique(["Code"])
    })

    // Fecha o ciclo do TrialStartAt/TrialEndAt que ja existe em Users.
    await knex.schema.createTable("Subscriptions", (table) => {
        table.increments("IdSubscription").primary()
        table.integer("IdWorkspace").unsigned().notNullable()
        table.integer("IdUser").unsigned().nullable()
        table.integer("IdPlan").unsigned().notNullable()
        table.enu("Status", ["trialing", "active", "past_due", "canceled", "expired"]).notNullable().defaultTo("trialing")
        table.datetime("StartedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("CurrentPeriodStart").nullable()
        table.datetime("CurrentPeriodEnd").nullable()
        table.datetime("CanceledAt").nullable()
        table.string("Provider", 100).nullable()
        table.string("ExternalId", 255).nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.foreign("IdPlan").references("IdPlan").inTable("Plans").onDelete("RESTRICT")
        table.index(["IdWorkspace", "Status"])
        table.index(["Provider", "ExternalId"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Subscriptions")
    await knex.schema.dropTable("Plans")
}
