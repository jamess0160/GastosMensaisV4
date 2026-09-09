import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Categoria temporaria: agrupa gastos por evento ("Viagem Chile", "Presente
    // de casamento") sem competir com Categories, que e a taxonomia permanente.
    // Um gasto tem UMA categoria e N tags.
    //
    // A tabela de vinculo e ExpenseTags, e nao TagLinks generica, para que
    // entradas possam ganhar InflowTags depois sem mexer nesta.
    await knex.schema.createTable("Tags", (table) => {
        table.increments("IdTag").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdUser").nullable()
        table.string("Name", 100).notNullable()
        table.string("Color", 7).nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")

        table.unique(["IdWorkspace", "Name"])
        table.index(["IdWorkspace"])
    })

    await knex.schema.createTable("ExpenseTags", (table) => {
        table.increments("IdExpenseTag").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdExpense").notNullable()
        table.integer("IdTag").notNullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdExpense").references("IdExpense").inTable("Expenses").onDelete("CASCADE")
        table.foreign("IdTag").references("IdTag").inTable("Tags").onDelete("CASCADE")

        table.unique(["IdExpense", "IdTag"])
        table.index(["IdTag"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("ExpenseTags")
    await knex.schema.dropTable("Tags")
}
