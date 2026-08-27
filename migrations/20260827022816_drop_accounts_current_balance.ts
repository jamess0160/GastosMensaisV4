import type { Knex } from "knex";


// Remove o cache de saldo. O saldo passa a ser sempre calculado a partir dos
// lancamentos, que sao a fonte da verdade:
//
//   InitialBalance
//   + Inflows recebidos com IdToAccount   = conta
//   - Inflows recebidos com IdFromAccount = conta      (transferencia que saiu)
//   - ExpensePayments pagos cujo PaymentMethod e da conta
//
// O motivo nao e economia de coluna: manter o cache exigiria que TODA rota que
// mexe em dinheiro lembrasse de recalcular (criar, editar, cancelar, receber,
// estornar, quitar, desquitar, mudar InitialBalance). Errar uma nao quebra nada -
// so faz o saldo divergir devagar, e saldo plausivel e errado e a pior falha
// possivel num app de financas.
//
// O que se ganharia era performance, que nao existe neste volume: os indices
// dessa leitura ja estao no banco (ExpensePayments[IdWorkspace,IdPaymentMethod,
// Paid], Inflows[IdToAccount], Inflows[IdFromAccount]).
//
// InitialBalance e InitialBalanceDate FICAM: sao dado de origem, nao cache.
// Nenhum lancamento do sistema deriva o saldo de abertura da conta.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Accounts", (table) => {
        table.dropColumn("CurrentBalance")
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("Accounts", (table) => {
        table.decimal("CurrentBalance", 15, 2).notNullable().defaultTo(0)
    })
}
