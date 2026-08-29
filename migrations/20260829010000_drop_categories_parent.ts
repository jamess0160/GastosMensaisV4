import type { Knex } from "knex";


// Categoria deixa de ser arvore: nao existe categoria filha de outra.
//
// A hierarquia custava tres coisas que a lista plana nao tem: conferir que o pai
// e visivel ao workspace, recusar ciclo (que deixaria o ramo sem raiz e o faria
// sumir da montagem continuando lancavel por id) e arrastar a subarvore inteira
// no arquivamento. Nada disso paga o proprio preco enquanto o app tem 13
// categorias globais e um punhado de proprias por workspace.
//
// A coluna e derrubada em migration nova, e nao editando a original, do mesmo
// jeito que o drop de Accounts.CurrentBalance: quem ja rodou a anterior nao
// pode ter um schema diferente de quem rodar agora.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Categories", (table) => {
        table.dropForeign(["IdParentCategory"])
        table.dropColumn("IdParentCategory")
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Categories", (table) => {
        table.integer("IdParentCategory").nullable()

        table.foreign("IdParentCategory").references("IdCategory").inTable("Categories").onDelete("SET NULL")
    })
}
