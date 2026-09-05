import type { Knex } from "knex";


// Orcamento por PESSOA, ao lado do orcamento por categoria.
//
// UMA TABELA SO, com o alvo em duas colunas mutuamente exclusivas - IdCategory OU
// IdPerson, nunca os dois -, e nao uma PersonBudgets paralela. O motivo e a
// BudgetPeriods: ela aponta para IdBudget, entao a maquina inteira do mes -
// congelar o teto, o unique(IdBudget, ReferenceMonth), o PUT do mes, o delete
// fisico do periodo e a rotina mensal que ainda vem - passa a servir aos dois sem
// uma linha nova. Uma tabela paralela duplicaria tudo isso, e a segunda copia e
// onde as duas divergiriam.
//
// SOBRE O NULL QUE VOLTA. A migration original (20260731003300_budgets.ts)
// comemora, com razao, que a unique atual funciona "sem NULL envolvido". O NULL
// volta aqui, mas O INDICE PARCIAL DEVOLVE A GARANTIA: cada indice so enxerga as
// linhas do seu tipo, e dentro delas nao ha NULL nenhum. E a diferenca entre um
// NULL que atravessa a regra e um NULL que o where do indice exclui.
//
// Os dois indices vao em raw porque o Knex nao tem indice parcial: table.unique()
// nao aceita um predicado.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Budgets", (table) => {
        table.integer("IdCategory").nullable().alter()
        table.integer("IdPerson").nullable()

        // CASCADE como o IdCategory: arquivar e Active=false, que preserva o
        // historico; delete de verdade leva o historico junto, como deve.
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("CASCADE")

        // dropUnique recebe as colunas, e nao o nome: o Knex deriva o nome do par
        // (tabela, colunas) com o mesmo gerador que usou na criacao.
        table.dropUnique(["IdWorkspace", "IdCategory"])
    })

    // Exatamente um dos dois. Sem ele, uma linha com os dois nulos seria um teto
    // sem alvo, e uma com os dois preenchidos entraria nos dois indices parciais
    // ao mesmo tempo.
    await knex.raw(`
        ALTER TABLE "Budgets"
        ADD CONSTRAINT "Budgets_target_check"
        CHECK (("IdCategory" IS NOT NULL) <> ("IdPerson" IS NOT NULL))
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "Budgets_workspace_category_unique"
        ON "Budgets" ("IdWorkspace", "IdCategory") WHERE "IdCategory" IS NOT NULL
    `)

    await knex.raw(`
        CREATE UNIQUE INDEX "Budgets_workspace_person_unique"
        ON "Budgets" ("IdWorkspace", "IdPerson") WHERE "IdPerson" IS NOT NULL
    `)
}


// A volta APAGA os orcamentos de pessoa, e leva os periodos deles junto pelo
// CASCADE de BudgetPeriods. Nao ha alternativa: a coluna IdCategory volta a ser
// NOT NULL e essas linhas nao tem categoria nenhuma para receber.
//
// E perda de plano, nao de lancamento - nenhum dinheiro passou por um periodo de
// orcamento, que e a mesma razao pela qual o DELETE de BudgetPeriods e fisico. Os
// orcamentos de categoria nao sao tocados.
export async function down(knex: Knex): Promise<void> {
    await knex("Budgets").whereNotNull("IdPerson").delete()

    await knex.raw(`DROP INDEX "Budgets_workspace_person_unique"`)
    await knex.raw(`DROP INDEX "Budgets_workspace_category_unique"`)
    await knex.raw(`ALTER TABLE "Budgets" DROP CONSTRAINT "Budgets_target_check"`)

    await knex.schema.alterTable("Budgets", (table) => {
        table.dropForeign(["IdPerson"])
        table.dropColumn("IdPerson")
        table.integer("IdCategory").notNullable().alter()
        table.unique(["IdWorkspace", "IdCategory"])
    })
}
