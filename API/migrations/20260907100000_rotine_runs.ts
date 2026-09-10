import type { Knex } from "knex";


// O registro de execucao das rotinas - a tabela que carrega o motor inteiro.
//
// O tick nao pergunta "que horas sao", pergunta "o que venceu e ainda nao foi
// registrado". Quem decide se uma rotina roda e o unique(Name, ScheduledFor):
// o motor tenta inserir a ocorrencia vencida com onConflict().ignore() e so
// roda quem conseguiu escrever. Isso compra tres coisas de uma vez:
//
// 1. Catch-up de graca. Servidor caido no dia 1o e de pe no dia 2: a ultima
//    ocorrencia vencida AINDA e a do dia 1o, ninguem a registrou, ela roda.
//    Nao existe uma linha de logica de recuperacao em lugar nenhum.
// 2. Idempotencia. Duas instancias, ou um restart em loop, e a segunda
//    simplesmente nao escreve e nao roda. Vale hoje com instancia unica e
//    continua valendo no dia em que nao for - que e o unico jeito de
//    escrever isso uma vez so.
// 3. Observabilidade. Historico consultavel, que sem a tabela so existiria
//    em arquivo de log.
//
// **Primeira tabela do projeto sem IdWorkspace**, e o desvio e consciente:
// ela nao e de dominio, e do sistema. Uma execucao atravessa todos os
// workspaces, entao escopa-la por tenant seria mentir sobre o que ela e.
//
// Nao existe tabela "Rotines". O catalogo das rotinas e codigo: um catalogo
// em banco permitiria desligar no banco uma rotina que o codigo ainda acha
// que existe, e e assim que os dois divergem. Ligar e desligar e editar a
// lista em rotines/index.ts, que o compilador confere e o deploy carrega.
//
// Sem Active: o ciclo de vida vem do Status, como manda a convencao.
export async function up(knex: Knex): Promise<void> {

    await knex.schema.createTable("RotineRuns", (table) => {
        table.increments("IdRotineRun").primary()
        // O nome declarado no registro (rotines/index.ts), nao um id de linha:
        // e ele que sobrevive a um rollback do banco e continua identificando
        // a mesma rotina.
        table.string("Name", 100).notNullable()
        // **String, e nao datetime, de proposito.** ScheduledFor e o *rotulo*
        // de uma ocorrencia ("2026-09-01 03:00" na hora local do servidor),
        // nao um instante sobre o qual se faz aritmetica. Como rotulo ele:
        //
        // - compara por igualdade exata, que e o que o unique abaixo precisa;
        // - nao passa por conversao de fuso na ida nem na volta, entao a
        //   mesma ocorrencia nunca vira duas linhas por causa do timezone da
        //   conexao;
        // - deixa lastDueOccurrence ser funcao pura de string para string,
        //   testavel em marco sem esperar marco chegar.
        table.string("ScheduledFor", 16).notNullable()
        table.datetime("StartedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("FinishedAt").nullable()
        table.enu("Status", ["running", "done", "failed"]).notNullable().defaultTo("running")
        // Texto e nao json: o que se guarda aqui e a mensagem que o operador
        // le, e o erro completo (stack incluido) ja vai para Logs/rotines/.
        table.text("Error").nullable()
        table.datetime("CreatedAt").notNullable().defaultTo(knex.fn.now())
        table.datetime("UpdatedAt").notNullable().defaultTo(knex.fn.now())

        // **A etapa inteira esta nesta linha.** E ele que transforma "rodar"
        // numa disputa que o banco arbitra, em vez de uma decisao que cada
        // instancia toma sozinha olhando o relogio.
        table.unique(["Name", "ScheduledFor"])
        // "as ultimas execucoes desta rotina", que e a consulta de operacao
        table.index(["Name", "StartedAt"])
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("RotineRuns")
}
