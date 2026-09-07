import type { Knex } from "knex";


// O cartao que conta como debito, e a data de caixa que sai de baixo dele.
//
// DUAS PESSOAS USAM CARTAO DE DOIS JEITOS INCOMPATIVEIS. Quem concentra o dia a
// dia e paga a fatura inteira todo mes trata o cartao como debito: o que passou
// nele em agosto E gasto de agosto. Quem usa como reserva passa no cartao
// justamente para pagar no mes seguinte: o gasto e do mes da fatura. Ate aqui so
// o segundo era atendido, e para o primeiro isso produzia exatamente a mentira
// que o indicador existe para evitar - em 20 de agosto, com metade do salario ja
// passada no cartao, o "posso gastar" ainda mostrava o mes quase inteiro livre.
//
// COMPETENCEMODE e um enum, nao um booleano: `IsEveryday: true` e ilegivel em
// seis meses. Nulo fora de credit_card, pela mesma razao de DueDay e
// ClosingOffsetDays - fora do cartao nao ha defasagem entre consumo e pagamento
// para escolher.
//
//     invoice   -> a CompetenceDate da perna e o DueDate (comportamento antigo)
//     purchase  -> ExpenseDate + (n-1) meses, a mesma formula do carne e do
//                  crediario fora do cartao. O avanco por parcela e o que impede
//                  600 em 6x de jogar 600 inteiros no mes da compra.
//
// CASHDATE e a outra metade da etapa, e sem ela ela nao poderia subir. Desde a
// 20260905120000 o saldo da conta corta pela CompetenceDate, o que hoje e
// inofensivo porque a coluna vale exatamente coalesce(DueDate, ExpenseDate) - mas
// no dia em que o modo 'purchase' gravar ExpenseDate + (n-1) meses, uma compra de
// 20/08 quitada na fatura de 05/09 sairia do saldo de AGOSTO e todo saldo de mes
// passado ficaria errado. Das duas saidas possiveis (o saldo voltar a cortar pelo
// vencimento, ou a perna ter duas datas) esta e a que sobrevive ao CompetenceMode,
// porque e ele que separa os dois conceitos pela primeira vez:
//
//     CompetenceDate -> quando a perna PESA      (orcamento, "posso gastar")
//     CashDate       -> quando o dinheiro SAI    (saldo da conta, extrato)
//
// O BACKFILL grava 'purchase' em todo cartao existente. Confirmado com o dono em
// 2026-09-07: nao ha base real em producao, entao nenhum numero muda de
// significado para ninguem - e a CompetenceDate ja gravada nao e reescrita, que e
// o que "trocar o modo vale para o futuro" quer dizer.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.enu("CompetenceMode", ["invoice", "purchase"]).nullable()
    })

    await knex("PaymentMethods").where("Kind", "credit_card").update({ CompetenceMode: "purchase" })

    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.date("CashDate").nullable()
    })

    // O backfill roda ANTES do notNullable, como o da CompetenceDate: a coluna
    // nasce anulavel, recebe o valor que as consultas ja calculavam e so entao
    // aperta. Sai da CompetenceDate porque hoje as duas sao a mesma coisa - e
    // sao a mesma coisa exatamente ate a primeira perna gravada em 'purchase'.
    await knex.raw(`UPDATE "ExpensePayments" SET "CashDate" = "CompetenceDate"`)

    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.date("CashDate").notNullable().alter()

        // O indice do que passou a ser a coluna de corte do saldo e do extrato.
        // O ["IdWorkspace","CompetenceDate"] fica: ele serve os outros leitores,
        // que continuam sendo por competencia.
        table.index(["IdWorkspace", "CashDate"])
    })
}


// A volta apaga as duas colunas. A CashDate se perde sem prejuizo - ela e
// reconstrutivel a qualquer momento por coalesce(DueDate, ExpenseDate), que e de
// onde ela saiu. Ja o CompetenceMode desaparece junto com a distincao: as pernas
// gravadas em 'purchase' continuam com a CompetenceDate que receberam, porque a
// data e congelada no lancamento, e o saldo volta a cortar pela competencia - que
// e a razao de esta migration nao poder ser desfeita sem pensar.
export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("ExpensePayments", (table) => {
        table.dropIndex(["IdWorkspace", "CashDate"])
        table.dropColumn("CashDate")
    })

    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("CompetenceMode")
    })
}
