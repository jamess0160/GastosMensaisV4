import type { Knex } from "knex";


// O estorno: gasto de valor NEGATIVO, so no cartao de credito.
//
// Um estorno de compra volta na fatura, as vezes na seguinte, e ate aqui nao
// tinha como ser lancado: a parede era tripla - o .positive() do Joi e estes tres
// CHECKs. Eles nao desaparecem, RELAXAM PARA <> 0: zero continua proibido, porque
// gasto de zero nao e lancamento nenhum.
//
// ESTORNO NAO E ENTRADA. Se virasse um Inflow, o saldo da conta subiria no mes do
// estorno e a fatura continuaria sendo paga cheia - erro dos dois lados. Nenhum
// dinheiro entra na conta num estorno: a FATURA e que encolhe.
//
// E o gasto negativo e o lugar certo porque o estorno tem todas as propriedades de
// um gasto com o sinal trocado - categoria (e assim que o credito volta ao
// orcamento certo), datas de fatura, competencia, rateio por pessoa e linha da
// fatura. Modelar como qualquer outra coisa significa reimplementar as cinco.
//
// O RECORTE "SO NO CREDITO" O BANCO NAO CONSEGUE IMPOR: o CHECK de ExpensePayments
// nao enxerga PaymentMethods. Por isso ele so garante <> 0, e a regra do cartao
// mora no ExpenseAxes, ao lado das outras que o banco nao garante (o fechamento de
// cada eixo com o total ja e assim).
//
// As constraints sao recriadas com nome novo: uma chamada "positive" que aceita
// negativo mentiria para quem lesse o schema daqui a um ano.
export async function up(knex: Knex): Promise<void> {
    await knex.raw(`ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_total_positive_check"`)
    await knex.raw(`ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_total_nonzero_check" CHECK ("TotalValue" <> 0)`)

    await knex.raw(`ALTER TABLE "ExpensePayments" DROP CONSTRAINT "ExpensePayments_value_positive_check"`)
    await knex.raw(`ALTER TABLE "ExpensePayments" ADD CONSTRAINT "ExpensePayments_value_nonzero_check" CHECK ("Value" <> 0)`)

    await knex.raw(`ALTER TABLE "ExpensePersons" DROP CONSTRAINT "ExpensePersons_value_positive_check"`)
    await knex.raw(`ALTER TABLE "ExpensePersons" ADD CONSTRAINT "ExpensePersons_value_nonzero_check" CHECK ("Value" <> 0)`)
}


// A volta APAGA os estornos - nao ha alternativa: eles existem depois desta
// migration e o CHECK de > 0 os recusaria. As pernas e o rateio deles vao junto
// pelo CASCADE de Expenses, que e o que garante que nao sobra metade de lancamento.
//
// So os negativos saem; nenhuma compra e tocada. E, ao contrario de um dropColumn,
// o que se perde aqui e recuperavel: o estorno esta no extrato do cartao e pode ser
// relancado como o que ele era antes desta etapa - nada, ou uma compra a menos
// digitada a mao.
export async function down(knex: Knex): Promise<void> {
    await knex("Expenses").where("TotalValue", "<", 0).delete()

    await knex.raw(`ALTER TABLE "ExpensePersons" DROP CONSTRAINT "ExpensePersons_value_nonzero_check"`)
    await knex.raw(`ALTER TABLE "ExpensePersons" ADD CONSTRAINT "ExpensePersons_value_positive_check" CHECK ("Value" > 0)`)

    await knex.raw(`ALTER TABLE "ExpensePayments" DROP CONSTRAINT "ExpensePayments_value_nonzero_check"`)
    await knex.raw(`ALTER TABLE "ExpensePayments" ADD CONSTRAINT "ExpensePayments_value_positive_check" CHECK ("Value" > 0)`)

    await knex.raw(`ALTER TABLE "Expenses" DROP CONSTRAINT "Expenses_total_nonzero_check"`)
    await knex.raw(`ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_total_positive_check" CHECK ("TotalValue" > 0)`)
}
