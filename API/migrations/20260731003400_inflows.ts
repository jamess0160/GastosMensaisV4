import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Substitui a cashinflows do V3, e absorve tambem a transferencia entre contas.
    //
    // Kind='inflow'   -> dinheiro vem de fora: IdFromAccount NULL, IdToAccount obrigatorio
    // Kind='transfer' -> entre contas do usuario: as duas obrigatorias e diferentes
    //
    // ATENCAO no relatorio: transferencia e soma zero para o patrimonio. Todo
    // "quanto entrou no mes" precisa de where Kind <> 'transfer', senao o mesmo
    // dinheiro e contado como entrada toda vez que muda de conta.
    //
    // Sem Active: o ciclo de vida e Status, e cancelar e Status='canceled'.
    // Recebimento e tudo ou nada: nao existe estado parcial.
    await knex.schema.createTable("Inflows", (table) => {
        table.increments("IdInflow").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdUser").nullable()
        table.string("Description", 255).notNullable()
        table.decimal("TotalValue", 15, 2).notNullable()
        table.enu("Status", ["pending", "received", "canceled"]).notNullable().defaultTo("pending")
        table.enu("Kind", ["inflow", "transfer"]).notNullable().defaultTo("inflow")
        table.integer("IdFromAccount").nullable()
        table.integer("IdToAccount").nullable()
        table.date("CompetenceDate").notNullable()
        table.date("ExpectedDate").nullable()
        table.datetime("ReceivedAt").nullable()
        table.text("Notes").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.foreign("IdFromAccount").references("IdAccount").inTable("Accounts").onDelete("RESTRICT")
        table.foreign("IdToAccount").references("IdAccount").inTable("Accounts").onDelete("RESTRICT")
        table.index(["IdWorkspace"])
        table.index(["IdWorkspace", "CompetenceDate"])
        table.index(["IdWorkspace", "Status", "ExpectedDate"])
        table.index(["IdToAccount"])
        table.index(["IdFromAccount"])
    })

    // Identificadores entre aspas duplas: o Postgres dobra para minusculo sem elas.
    await knex.raw(`
        ALTER TABLE "Inflows"
        ADD CONSTRAINT "Inflows_kind_accounts_check"
        CHECK (
            ("Kind" = 'inflow'   AND "IdToAccount" IS NOT NULL)
         OR ("Kind" = 'transfer' AND "IdToAccount" IS NOT NULL AND "IdFromAccount" IS NOT NULL)
        )
    `)

    await knex.raw(`
        ALTER TABLE "Inflows"
        ADD CONSTRAINT "Inflows_accounts_differ_check"
        CHECK ("IdFromAccount" IS NULL OR "IdFromAccount" <> "IdToAccount")
    `)

    // Quem recebeu: rateio da entrada entre Persons, por valor absoluto.
    // A soma dos Value tem que fechar com Inflows.TotalValue (validado no model).
    //
    // So faz sentido em Kind='inflow': ratear uma transferencia entre contas
    // proprias nao significa nada, entao transfer nao gera linha aqui.
    await knex.schema.createTable("InflowPersons", (table) => {
        table.increments("IdInflowPerson").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdInflow").notNullable()
        table.integer("IdPerson").notNullable()
        table.decimal("Value", 15, 2).notNullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdInflow").references("IdInflow").inTable("Inflows").onDelete("CASCADE")
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("RESTRICT")

        table.unique(["IdInflow", "IdPerson"])
        table.index(["IdPerson"])
    })

    await knex.raw(`
        ALTER TABLE "InflowPersons"
        ADD CONSTRAINT "InflowPersons_value_positive_check"
        CHECK ("Value" > 0)
    `)
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("InflowPersons")
    await knex.schema.dropTable("Inflows")
}
