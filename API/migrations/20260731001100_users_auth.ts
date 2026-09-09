import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Carry-over da usersauth do V3 (WebAuthn / passkey).
    await knex.schema.createTable("UsersAuth", (table) => {
        table.increments("IdUserAuth").primary()
        table.integer("IdUser").unsigned().notNullable()
        table.string("CredentialId", 255).notNullable()
        table.binary("PublicKey").notNullable()
        table.bigInteger("Counter").notNullable().defaultTo(0)
        table.string("DeviceKey", 255).nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.unique(["CredentialId"])
        table.index(["IdUser"])
    })

    // Carry-over da ignoreauth do V3 (dispositivo confiavel).
    await knex.schema.createTable("TrustedDevices", (table) => {
        table.increments("IdTrustedDevice").primary()
        table.integer("IdUser").unsigned().notNullable()
        table.string("DeviceKey", 255).notNullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("CASCADE")
        table.unique(["IdUser", "DeviceKey"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("TrustedDevices")
    await knex.schema.dropTable("UsersAuth")
}
