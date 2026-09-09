import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("Users", (table) => {
        table.increments("IdUser").primary()
        table.string("Name", 255).notNullable()
        table.string("Email", 255).notNullable()
        table.string("Password", 255).notNullable()
        //  Até 12 dígitos (DDI + DDD + número): não cabe em integer
        table.bigInteger("Phone").notNullable()
        table.datetime("LastLogin").notNullable().defaultTo(knex.fn.now())
        table.datetime("TrialStartAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("TrialEndAt").nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.unique(["Email"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Users")
}
