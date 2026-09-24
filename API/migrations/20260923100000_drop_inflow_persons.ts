import type { Knex } from "knex";


// O rateio da renda entre pessoas sai do produto, e com ele a tabela.
//
// InflowPersons existe desde a primeira migration (20260731003400_inflows.ts) e
// respondia "de quem e esse dinheiro" numa epoca em que o orcamento nao sabia
// responder nada: ate a leva 9 ele era um teto perene por categoria. A leva 9
// trocou isso - BudgetPeriods carrega alvo de pessoa e/ou categoria, e o
// orcamento E a reparticao da renda do mes. A pergunta passou a ter duas
// respostas no mesmo produto, e elas nao conversam: este rateio nao alimenta
// fatia nenhuma, nenhum relatorio o cruza com o gasto, e ninguem compara os
// dois. Duas respostas que nada obriga a concordar divergem na primeira vez que
// alguem preencher uma e esquecer a outra.
//
// ATENCAO, e e o unico ponto que importa aqui: o `down` recria a ESTRUTURA
// vazia, nunca as LINHAS. Depois desta migration a informacao nao existe mais
// em lugar nenhum, e isso e decisao de produto, nao efeito colateral. Um `down`
// que parecesse reversivel seria pior do que um que declara o que perdeu.
//
// O que NAO sai: ExpensePersons. As duas tabelas tem o mesmo formato e o mesmo
// nome de coluna, e a diferenca e toda no que elas alimentam - o eixo analitico
// do gasto e um dos dois eixos que o modelo assume, casa com o orcamento
// (BudgetSpent) e desenha a quebra "Por destino" do Inicio.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.dropTable("InflowPersons")
}


export async function down(knex: Knex): Promise<void> {
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
        // RESTRICT como era: o soft delete de Persons nasceu dos dois rateios, e
        // reconstruir a estrutura pela metade daria a um `down` seguido de `up`
        // um esquema diferente do que existia.
        table.foreign("IdPerson").references("IdPerson").inTable("Persons").onDelete("RESTRICT")

        table.unique(["IdInflow", "IdPerson"])
        table.index(["IdPerson"])
    })

    // Identificadores entre aspas duplas: o Postgres dobra para minusculo sem elas.
    await knex.raw(`
        ALTER TABLE "InflowPersons"
        ADD CONSTRAINT "InflowPersons_value_positive_check"
        CHECK ("Value" > 0)
    `)
}
