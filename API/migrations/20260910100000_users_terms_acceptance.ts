import type { Knex } from "knex";


// O aceite dos termos vira registro: DUAS COLUNAS, e nenhuma tabela.
//
// Ate aqui o aceite existia so na memoria do navegador. O checkbox era conferido
// em `submitSignUp` e o corpo que subia para `POST /Users` nao dizia nada sobre
// termos. Sao duas falhas, nao uma: nao ha prova de consentimento (se alguem
// perguntar quando e o que aquele usuario aceitou, a resposta honesta e "nao
// sei"), e a validacao e do cliente e so dele - um `POST /Users` por curl cria a
// conta sem aceitar nada, e o Joi aceita porque o campo nao existe para ser
// exigido.
//
// **TermsAcceptedAt e o QUANDO; TermsVersion e o QUE.** A versao e a data
// impressa no topo dos dois documentos (`/termos` e `/privacidade`), na forma
// "YYYY-MM-DD" - dez caracteres, que e o tamanho da coluna. Nao ha numeracao
// paralela a manter em sincronia: mudou o texto, muda a data.
//
// **Quem carimba a versao e o servidor**, com a constante de
// `routes/Users/sections/TermsVersion.ts`. O corpo do cadastro ganha um
// `AcceptedTerms: boolean` obrigatorio e obrigatoriamente `true`, e nada alem
// disso: deixar o cliente mandar a versao seria aceitar que ele afirmasse ter
// concordado com um documento antigo, que e o oposto do que o campo prova.
//
// **Sem backfill**, pelo mesmo raciocinio do `EmailConfirmedAt`: quem ja existe
// nasce com os dois nulos porque e a verdade - essas pessoas nao aceitaram
// documento nenhum, ja que nao havia documento. Carimbar seria escrever no banco
// uma coisa que nao aconteceu, e e exatamente o registro que perderia o valor.
//
// **O nulo nao bloqueia nada nesta leva.** O re-aceite - o que fazer quando o
// documento muda e a versao gravada fica velha - precisa de tela e de regra de
// produto. O que estas duas colunas entregam e tornar essa decisao possivel
// depois, sem migration.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Users", (table) => {
        table.datetime("TermsAcceptedAt").nullable()
        table.string("TermsVersion", 10).nullable()
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Users", (table) => {
        table.dropColumn("TermsAcceptedAt")
        table.dropColumn("TermsVersion")
    })
}
