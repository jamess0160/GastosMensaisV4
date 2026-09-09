import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable("UserDevices", (table) => {
        table.increments("IdUserDevice").primary()
        table.integer("IdUser").unsigned().notNullable()
        table.string("DeviceKey", 255).notNullable()
        table.enu("Platform", ["ios", "android", "web"]).notNullable()
        table.string("PushToken", 255).nullable()
        table.datetime("LastSeenAt").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.unique(["IdUser", "DeviceKey"])
    })

    // EntityType/EntityId apontam para o registro que originou a notificacao,
    // sem FK, porque a origem varia conforme o tipo.
    await knex.schema.createTable("Notifications", (table) => {
        table.increments("IdNotification").primary()
        table.integer("IdWorkspace").unsigned().notNullable()
        table.integer("IdUser").unsigned().notNullable()
        table.enu("Type", ["system", "security"]).notNullable()
        table.string("Title", 255).notNullable()
        table.text("Body").nullable()
        table.string("EntityType", 100).nullable()
        table.integer("EntityId").unsigned().nullable()
        table.datetime("ScheduledFor").nullable()
        table.datetime("SentAt").nullable()
        table.datetime("ReadAt").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.index(["IdUser", "ReadAt"])
        table.index(["ScheduledFor", "SentAt"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Notifications")
    await knex.schema.dropTable("UserDevices")
}
