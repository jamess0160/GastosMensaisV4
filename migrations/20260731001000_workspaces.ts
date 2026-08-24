import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable("Workspaces", (table) => {
        table.increments("IdWorkspace").primary()
        table.string("Name", 255).notNullable()
        table.integer("IdOwnerUser").unsigned().notNullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdOwnerUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.index(["IdOwnerUser"])
    })

    await knex.schema.createTable("WorkspaceMembers", (table) => {
        table.increments("IdWorkspaceMember").primary()
        table.integer("IdWorkspace").unsigned().notNullable()
        table.integer("IdUser").unsigned().notNullable()
        table.enu("Role", ["owner", "editor", "viewer"]).notNullable().defaultTo("owner")
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.unique(["IdWorkspace", "IdUser"])
        table.index(["IdUser"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("WorkspaceMembers")
    await knex.schema.dropTable("Workspaces")
}
