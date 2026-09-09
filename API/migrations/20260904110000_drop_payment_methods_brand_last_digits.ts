import type { Knex } from "knex";


// Bandeira e final do cartao saem do cadastro.
//
// Os dois campos existiam para identificar o cartao na tela ("Nubank ****1234"),
// e nenhuma regra do sistema le qualquer um deles: a fatura sai de DueDay e
// ClosingOffsetDays, o saldo sai da perna, o rateio sai do gasto. O que o usuario
// realmente usa para reconhecer a forma de pagamento e o Name, que ele escreve.
//
// O LastDigits carregava, alem disso, um custo que nao pagava nada: sao quatro
// digitos de um cartao real guardados em texto puro, num campo que so servia de
// rotulo. Menos dado sensivel gravado e menos dado sensivel para vazar.
//
// Migration nova de drop, e nao edicao da 20260731003000_accounts.ts: mesmo
// precedente do drop de Accounts.CurrentBalance e de Categories.IdParentCategory
// - quem ja rodou a migration original nao pode ficar com schema diferente de
// quem rodar agora.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("Brand")
        table.dropColumn("LastDigits")
    })
}


// As colunas voltam nullable, mas O DADO NAO VOLTA: ele foi apagado com o
// dropColumn e nao ha de onde reconstrui-lo, ao contrario do ClosingDay, que
// ainda podia sair do vencimento menos a folga. Todo cartao volta com bandeira e
// final nulos.
export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.string("Brand", 100).nullable()
        table.string("LastDigits", 4).nullable()
    })
}
