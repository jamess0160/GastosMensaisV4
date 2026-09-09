import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // Substitui a banks do V3: conta bancaria de verdade, nao agrupador de forma
    // de pagamento. InitialBalance + data existem porque sem eles o saldo
    // calculado nasce errado; CurrentBalance e cache recalculavel do zero.
    await knex.schema.createTable("Accounts", (table) => {
        table.increments("IdAccount").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdUser").nullable()
        table.string("Name", 255).notNullable()
        table.enu("Type", ["checking", "cash"]).notNullable().defaultTo("checking")
        table.string("IconPath", 255).nullable()
        table.string("Color", 7).nullable()
        table.decimal("InitialBalance", 15, 2).notNullable().defaultTo(0)
        table.date("InitialBalanceDate").nullable()
        table.decimal("CurrentBalance", 15, 2).notNullable().defaultTo(0)
        table.integer("Position").nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.index(["IdWorkspace"])
    })

    // Filhas da conta. Agrupam pix, debito e cartao de credito no mesmo cadastro.
    // Criar uma conta gera automaticamente as linhas 'pix' e 'debit'; cartao de
    // credito e adicionado pelo usuario, quantos ele tiver.
    //
    // ClosingDay/DueDay so fazem sentido em Kind='credit_card' e sao o que vai
    // permitir, na etapa de gastos, saber em qual fatura uma compra cai - um dia
    // de diferenca na compra vira um mes de diferenca no caixa.
    await knex.schema.createTable("PaymentMethods", (table) => {
        table.increments("IdPaymentMethod").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdAccount").notNullable()
        table.string("Name", 255).notNullable()
        table.enu("Kind", ["pix", "debit", "credit_card"]).notNullable()
        table.smallint("ClosingDay").nullable()
        table.smallint("DueDay").nullable()
        table.string("Brand", 100).nullable()
        table.string("LastDigits", 4).nullable()
        table.string("IconPath", 255).nullable()
        table.string("Color", 7).nullable()
        table.integer("Position").nullable()
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdAccount").references("IdAccount").inTable("Accounts").onDelete("CASCADE")
        table.index(["IdAccount"])
        table.index(["IdWorkspace", "Kind"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("PaymentMethods")
    await knex.schema.dropTable("Accounts")
}
