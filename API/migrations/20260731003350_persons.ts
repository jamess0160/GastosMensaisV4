import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Quem recebeu e quem gastou o dinheiro. Substitui a destinys do V3 e resolve
    // a limitacao de usar Users direto: uma pessoa NAO precisa ter login para
    // receber rateio. Filho, conjuge que nao usa o app, socio - todos existem aqui.
    //
    // IdUser e o vinculo opcional: quando a pessoa tambem e usuario do sistema,
    // aponta para a conta dela. Nulo = pessoa que so existe para fins de rateio.
    await knex.schema.createTable("Persons", (table) => {
        table.increments("IdPerson").primary()
        table.integer("IdWorkspace").notNullable()
        table.string("Name", 255).notNullable()
        table.integer("IdUser").nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")

        table.unique(["IdWorkspace", "Name"])
        // Nulo repetido e permitido no Postgres, que e exatamente o desejado:
        // varias pessoas sem login, mas um usuario nunca vira duas pessoas.
        table.unique(["IdUser"])
        table.index(["IdWorkspace"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("Persons")
}
