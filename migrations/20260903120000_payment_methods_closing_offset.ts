import type { Knex } from "knex";


// O fechamento do cartao deixa de ser um dia do mes e passa a ser uma folga em
// dias antes do vencimento.
//
// Foi assim que o modelo passou a pedir o dado que o usuario realmente tem: nos
// emissores brasileiros ninguem escolhe o dia do fechamento, escolhe o
// vencimento, e o fechamento sai dele por subtracao (a folga varia por emissor,
// tipicamente entre 6 e 10 dias - nao ha padrao do setor, so o modelo).
//
// Guardar o fechamento como dia do mes tinha dois defeitos que a folga nao tem:
//
// 1. Nem todo mes tem dia 29, 30 ou 31, entao o dia nominal era grampeado no
//    ultimo dia do mes na hora de virar data - e a comparacao "comprou ate o
//    fechamento" seguia usando o nominal. As duas metades da regra falavam de
//    datas diferentes em fevereiro. Vencimento menos N dias e sempre uma data
//    real, sem grampeamento.
// 2. A rolagem do vencimento era inferida de dois numeros soltos
//    (DueDay <= ClosingDay => proximo mes), porque o modelo nao guardava a
//    relacao entre eles. Com o vencimento como ancora a relacao e a subtracao,
//    e nao ha o que inferir.
//
// O backfill grava a folga de 7 dias em todo cartao existente em vez de deriva-la
// do par antigo: o ClosingDay gravado e justamente o dado que o modelo velho
// fazia o usuario adivinhar, entao derivar dele propagaria o erro. 7 e o valor
// mais comum e o default da coluna; cada cartao deve ser conferido no app do
// banco depois.
//
// Coluna derrubada em migration nova, e nao editando a original, como no drop de
// Accounts.CurrentBalance e Categories.IdParentCategory.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.smallint("ClosingOffsetDays").nullable()
    })

    await knex("PaymentMethods").where("Kind", "credit_card").update({ ClosingOffsetDays: 7 })

    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("ClosingDay")
    })
}


// A volta e aproximada de proposito: o dia do mes do fechamento nao existe mais
// como dado, entao ele e reconstruido como DueDay - folga, somando 30 quando a
// conta cai em zero ou negativo (vence dia 5 com folga de 7 fecha no dia 28 do
// mes anterior). E a melhor reconstrucao possivel, nao a original.
export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.smallint("ClosingDay").nullable()
    })

    await knex("PaymentMethods")
        .where("Kind", "credit_card")
        .whereNotNull("DueDay")
        .whereNotNull("ClosingOffsetDays")
        .update({
            ClosingDay: knex.raw(`case when "DueDay" - "ClosingOffsetDays" <= 0 then "DueDay" - "ClosingOffsetDays" + 30 else "DueDay" - "ClosingOffsetDays" end`),
        })

    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("ClosingOffsetDays")
    })
}
