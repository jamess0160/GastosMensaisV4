import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("Users", (table) => {
        table.increments("IdUser").primary()
        table.string("Name", 255).notNullable()
        table.string("Email", 255).notNullable()
        table.string("Password", 255).notNullable()
        table.integer("Phone").notNullable()
        table.datetime("LastLogin").notNullable().defaultTo(knex.fn.now())
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdateAt").notNullable().defaultTo(knex.fn.now())

        // table.foreign("IdCashInflow").references("IdCashInflow").inTable("cashinflows").onDelete("CASCADE")
        // table.foreign("IdDestiny").references("IdDestiny").inTable("destinys").onDelete("CASCADE")
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Users")
}