import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Categoria de GASTO. Entradas ganham categoria na etapa em que entradas
    // forem modeladas - se der, reaproveitando esta tabela com um discriminador.
    //
    // IdWorkspace nulo = categoria pre-definida global do sistema. A leitura
    // sempre e where(IdWorkspace = X or IdWorkspace is null).
    await knex.schema.createTable("Categories", (table) => {
        table.increments("IdCategory").primary()
        table.integer("IdWorkspace").nullable()
        table.integer("IdParentCategory").nullable()
        table.string("Description", 255).notNullable()
        table.string("IconKey", 100).nullable()
        table.string("Color", 7).nullable()
        table.integer("Position").nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdParentCategory").references("IdCategory").inTable("Categories").onDelete("SET NULL")
        table.index(["IdWorkspace"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Categories")
}
