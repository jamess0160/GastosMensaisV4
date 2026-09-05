import type { Knex } from "knex";


// Os dois fatos que faltavam a perna do cartao, e a data de competencia.
//
// O DIAGNOSTICO. O Paid significava duas coisas diferentes conforme a forma de
// pagamento, e o AccountBalance confiava nele nos dois casos: no pix e no debito
// "o dinheiro saiu da conta"; no cartao, marcar a perna nao tira dinheiro de
// conta nenhuma - quem tira e o pagamento da fatura, semanas depois. E como so
// existia o pay de UMA perna por vez, ninguem marcava as 40 compras de uma
// fatura: as pernas ficavam pending para sempre e o saldo nunca descia.
//
// Sao TRES fatos, e dois deles dividiam o mesmo booleano:
//
//   prevista           -> a ocorrencia do gasto fixo, que ja existe
//   entrou na fatura   -> Charged/ChargedAt (novo)   quem sabe e o usuario
//   fatura paga        -> Paid/PaidAt                quem sabe e o payInvoice
//
// Charged e NULO fora do cartao, pela mesma razao que ClosingDate e DueDate ficam:
// nao ha fatura, e a data do gasto ja diz tudo. Essa nulidade e, tambem, o que
// permite a qualquer leitor saber que a perna e de cartao sem reler a forma de
// pagamento - inclusive quando o cartao foi arquivado depois.
//
// COMPETENCEDATE nasce aqui gravada com o valor de hoje, coalesce(DueDate,
// ExpenseDate). Nada muda de comportamento: e a mesma data que as consultas ja
// calculavam. O que ela compra e o futuro - BudgetSpent, AccountBalance e a lista
// de pernas do periodo passam a ler uma coluna em vez de repetir o coalesce, e o
// CompetenceMode (etapa 5 da leva 3) vira so uma mudanca no que se ESCREVE aqui,
// sem tocar em leitor nenhum. Congelada na perna, como ClosingDate e DueDate ja
// sao, para virar a chave do cartao nao reescrever mes fechado.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.boolean("Charged").nullable()
        table.datetime("ChargedAt").nullable()
        table.date("CompetenceDate").nullable()
    })

    // O backfill roda ANTES do notNullable: a coluna nasce anulavel, recebe o
    // valor que as consultas ja calculavam e so entao aperta.
    await knex.raw(`
        UPDATE "ExpensePayments"
        SET "CompetenceDate" = coalesce("ExpensePayments"."DueDate", "Expenses"."ExpenseDate")
        FROM "Expenses"
        WHERE "Expenses"."IdExpense" = "ExpensePayments"."IdExpense"
    `)

    // Perna de cartao que ja existia nasce "nao cobrada", que e a verdade: ninguem
    // marcou nada ainda. Fora do cartao fica nula, e e assim que ela fica.
    await knex.raw(`
        UPDATE "ExpensePayments"
        SET "Charged" = false
        FROM "PaymentMethods"
        WHERE "PaymentMethods"."IdPaymentMethod" = "ExpensePayments"."IdPaymentMethod"
          AND "PaymentMethods"."Kind" = 'credit_card'
    `)

    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.date("CompetenceDate").notNullable().alter()

        // O indice do que virou a coluna de filtro de tres leitores (saldo da
        // conta, comprometido do orcamento e a lista de pernas do periodo). O
        // ["IdWorkspace","DueDate"] fica: ele ainda serve a consulta da fatura,
        // que e por (IdPaymentMethod, DueDate).
        table.index(["IdWorkspace", "CompetenceDate"])
    })
}


// A volta apaga as tres colunas. Charged e ChargedAt se perdem de verdade - nao
// ha de onde reconstruir "o usuario conferiu que esta cobranca entrou na fatura",
// que e afirmacao dele e de mais ninguem. A CompetenceDate volta a ser calculada
// pelo coalesce a cada consulta, que e de onde ela saiu.
export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.dropIndex(["IdWorkspace", "CompetenceDate"])
        table.dropColumn("CompetenceDate")
        table.dropColumn("ChargedAt")
        table.dropColumn("Charged")
    })
}
