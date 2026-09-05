import type { Knex } from "knex";


// Conta do tipo 'card': o vale-alimentacao.
//
// Um cartao com saldo proprio, sem conta bancaria atras e sem fatura. Ate aqui o
// cadastro obrigava a escolher entre 'checking' (que nasce com pix + debito) e
// 'cash' (que nasce com "Dinheiro"), e nenhum dos dois descreve um vale.
//
// O mecanismo e o do 'cash': uma forma de pagamento so, Kind='debit'. O que muda
// e o nome, que ali e fixo ("Dinheiro") e aqui e o da conta - "Vale Alimentacao"
// e o que o usuario quer ver na hora de escolher como pagou. Nao ha Kind='voucher'
// porque ele seria um valor SEM REGRA PROPRIA: o InvoiceDates continuaria
// devolvendo nulos, o AccountBalance continuaria somando igual, e todo switch do
// sistema ganharia um caso que nao muda nada. Quem precisa do rotulo tem o Name.
//
// O Type e enu(["checking","cash"]), que no Postgres o Knex traduz para text +
// CHECK - ampliar e derrubar a constraint e recria-la com os tres valores. O nome
// veio de `select conname from pg_constraint where conrelid = '"Accounts"'::regclass`,
// nao de chute: o Knex o deriva do par (tabela, coluna) e um DROP com nome errado
// so falharia na hora de rodar.
//
// Migration nova, e nao edicao da 20260731003000_accounts.ts: mesmo precedente do
// drop de Accounts.CurrentBalance e do de PaymentMethods.Brand - quem ja rodou a
// original nao pode ficar com schema diferente de quem rodar agora.
export async function up(knex: Knex): Promise<void> {
    await knex.raw(`ALTER TABLE "Accounts" DROP CONSTRAINT "Accounts_Type_check"`)

    await knex.raw(`
        ALTER TABLE "Accounts"
        ADD CONSTRAINT "Accounts_Type_check"
        CHECK ("Type" = ANY (ARRAY['checking'::text, 'cash'::text, 'card'::text]))
    `)
}


// A volta REESCREVE as contas 'card' como 'cash', e nao pode ser diferente: elas
// existem depois desta migration e a constraint de dois valores as recusaria.
//
// A perda e so o rotulo. As duas sao contas de saldo fechado, com uma unica forma
// de pagamento 'debit' e sem fatura - o que muda e o nome dessa forma, que
// continua sendo o da conta em vez de "Dinheiro". Nenhum lancamento se move, e e
// por isso que a conversao e segura onde um dropColumn nao seria.
export async function down(knex: Knex): Promise<void> {
    await knex("Accounts").where("Type", "card").update({ Type: "cash" })

    await knex.raw(`ALTER TABLE "Accounts" DROP CONSTRAINT "Accounts_Type_check"`)

    await knex.raw(`
        ALTER TABLE "Accounts"
        ADD CONSTRAINT "Accounts_Type_check"
        CHECK ("Type" = ANY (ARRAY['checking'::text, 'cash'::text]))
    `)
}
