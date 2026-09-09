import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    // A DEFINICAO vigente: quanto vale o teto desta categoria a partir de agora.
    // Uma linha por categoria; parar de orcar e Active=false, nao delete.
    // Nao tem mes: mes e assunto da BudgetPeriods.
    await knex.schema.createTable("Budgets", (table) => {
        table.increments("IdBudget").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdUser").nullable()
        table.integer("IdCategory").notNullable()
        table.decimal("LimitValue", 15, 2).notNullable()
        table.smallint("AlertPercent").notNullable().defaultTo(80)
        table.boolean("Active").notNullable().defaultTo(true)
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        table.foreign("IdUser").references("IdUser").inTable("Users").onDelete("SET NULL")
        table.foreign("IdCategory").references("IdCategory").inTable("Categories").onDelete("CASCADE")

        // Sem NULL envolvido, entao esta unique funciona de verdade - diferente
        // da versao anterior, que tinha ReferenceMonth anulavel e nao barrava
        // duas linhas recorrentes para a mesma categoria.
        table.unique(["IdWorkspace", "IdCategory"])
        table.index(["IdWorkspace"])
    })

    // O HISTORICO: uma linha por orcamento por mes, com o valor daquele mes.
    // Materializada por rotina no inicio do mes a partir de Budgets.LimitValue.
    //
    // E o que permite as tres coisas que uma tabela so nao dava:
    //   - "em marco meu teto de mercado era 800"     -> le a linha de marco
    //   - mudar o teto sem reescrever o passado      -> altera Budgets, meses fechados ficam
    //   - ajustar so um mes ("dezembro pode 1.500")  -> altera a linha de dezembro
    await knex.schema.createTable("BudgetPeriods", (table) => {
        table.increments("IdBudgetPeriod").primary()
        table.integer("IdWorkspace").notNullable()
        table.integer("IdBudget").notNullable()
        table.date("ReferenceMonth").notNullable()
        table.decimal("LimitValue", 15, 2).notNullable()
        table.smallint("AlertPercent").notNullable().defaultTo(80)
        table.enu("Status", ["open", "closed"]).notNullable().defaultTo("open")
        table.datetime("ClosedAt").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        table.foreign("IdWorkspace").references("IdWorkspace").inTable("Workspaces").onDelete("CASCADE")
        // CASCADE, nao RESTRICT: um RESTRICT aqui travaria o CASCADE que vem de
        // Workspaces. Arquivar um orcamento e Active=false, que preserva o
        // historico; delete de verdade leva o historico junto, como deve.
        table.foreign("IdBudget").references("IdBudget").inTable("Budgets").onDelete("CASCADE")

        table.unique(["IdBudget", "ReferenceMonth"])
        table.index(["IdWorkspace", "ReferenceMonth"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("BudgetPeriods")
    await knex.schema.dropTable("Budgets")
}
