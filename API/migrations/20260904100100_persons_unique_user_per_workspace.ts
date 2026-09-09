import type { Knex } from "knex";


// A pessoa de um usuario passa a ser unica POR WORKSPACE, e nao no banco inteiro.
//
// O indice original (20260731003350_persons.ts) era unique(["IdUser"]) global, e
// isso so nao doia enquanto cada usuario tinha exatamente um workspace. Com o
// convite deixa de ser hipotese: o convidado entra num segundo workspace, a
// createSelf tenta criar a pessoa dele la, e o indice barra - entregando um
// membro que nao pode receber um centavo de rateio, porque todo rateio e entre
// Persons e ele nao e pessoa nenhuma naquele tenant.
//
// O que o indice garante continua garantido dentro do tenant: um usuario nunca
// vira duas pessoas no mesmo workspace, que e o caso que quebraria a tela de
// rateio. Nulo repetido segue permitido no Postgres, que e o desejado - varias
// pessoas sem login no mesmo workspace.
//
// dropUnique/unique recebem as colunas em vez do nome da constraint de proposito:
// o Knex deriva o nome do par (tabela, colunas) com o mesmo gerador que usou na
// criacao, entao ele casa com o que esta no banco sem ninguem precisar adivinhar.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Persons", (table) => {
        table.dropUnique(["IdUser"])
        table.unique(["IdWorkspace", "IdUser"])
    })
}


// A volta desfaz o vinculo antes de reapertar o indice, e nao pode ser diferente:
// depois de um convite aceito o mesmo usuario e pessoa em dois workspaces, que e
// exatamente o estado que esta migration existe para permitir - recriar o
// unique(IdUser) global sobre ele falharia.
//
// O que ela apaga e o IdUser das pessoas EXTRA (as de IdPerson maior; a menor e a
// do proprio workspace do usuario, criada no cadastro). A linha continua la, com
// todo o rateio que aponta para ela: ela so deixa de ser "esta pessoa tambem e
// um usuario" e vira pessoa sem login, que e um estado legitimo do modelo desde
// sempre. Apagar a linha nao seria opcao - ExpensePersons e InflowPersons apontam
// para ela com ON DELETE RESTRICT, e o rateio do mes passado tem que continuar
// apontando para quem de fato entrou nele.
//
// O vinculo desfeito nao volta: so a createSelf escreve o IdUser de uma pessoa, e
// ela roda no cadastro e no aceite de convite. Escrito aqui como as outras
// migrations de perda registram a delas.
export async function down(knex: Knex): Promise<void> {
    await knex("Persons")
        .whereNotNull("IdUser")
        .whereNotIn("IdPerson", knex("Persons").whereNotNull("IdUser").min("IdPerson as IdPerson").groupBy("IdUser"))
        .update({ IdUser: null })

    await knex.schema.alterTable("Persons", (table) => {
        table.dropUnique(["IdWorkspace", "IdUser"])
        table.unique(["IdUser"])
    })
}
