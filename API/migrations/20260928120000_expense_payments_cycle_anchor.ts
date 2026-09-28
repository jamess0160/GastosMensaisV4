import type { Knex } from "knex";
import moment from "moment";


// A fatura pesa no mes em que estao as COMPRAS dela, e nao no mes em que ela
// fecha.
//
// A MIGRATION ANTERIOR (20260922130000) FOI CALIBRADA NUM CARTAO SO. Ela fez a
// compra pesar no mes do ciclo que a pegou, e mediu esse mes pelo dia do
// fechamento - o que e certo num cartao que fecha dia 30, porque ali o fechamento
// e o fim do mes. Num cartao que fecha dia 3 as duas coisas deixam de ser a mesma:
//
//     fecha 3, vence 10 - a fatura que fecha em 03/10 leva as compras de
//     04/09 a 03/10, 27 dos seus 30 dias sao setembro, e ela era batizada de
//     OUTUBRO. A compra de 05/09 pesava em outubro.
//
// A CORRECAO E UMA ANCORA DE CICLO, somada ao deslocamento que ja existia:
//
//     cycleShift     = (dia(ExpenseDate) > ClosingDay ? 1 : 0)
//                    - (ClosingDay <= 15 ? 1 : 0)
//     CompetenceDate = ExpenseDate + (cycleShift + index) meses
//
// A primeira parcela da soma e a da migration anterior, intacta: QUAL FATURA
// PEGOU ESTA COMPRA. A segunda e nova: DE QUE MES E ESSA FATURA. Um ciclo tem
// cerca de trinta dias e termina no ClosingDay, entao ele tem ClosingDay dias no
// mes do fechamento e 30 - ClosingDay no anterior - a fatura e do mes onde esta a
// maioria dos dias dela, e a maioria vira na metade do mes. O 15 e FIXO de
// proposito: com o daysInMonth real (14 em fevereiro, 15,5 em julho) o mesmo
// cartao trocaria de regra ao longo do ano, que e o defeito que o ClosingDay
// matou.
//
// SO OS CARTOES COM ClosingDay <= 15 SAO REESCRITOS. Nos outros a ancora e 0 e a
// formula nova da o mesmo resultado da velha; reescrever linha para gravar o mesmo
// valor so mexeria no UpdatedAt.
//
// SO A CompetenceDate E REESCRITA. ClosingDate, DueDate e CashDate nao mudam nesta
// etapa - o dinheiro sai quando a fatura vence, e isso nunca foi o que estava
// errado -, e por isso o saldo e identico antes e depois. Paid, Charged, PaidAt e
// ChargedAt nao sao tocados: eles sao fato, nao derivacao. Isto MOVE GASTO ENTRE
// MESES no orcamento e no relatorio de quem tem cartao de fechamento cedo, e e o
// ponto - os numeros velhos estao errados.
//
// A ARITMETICA DE CALENDARIO ESTA COPIADA AQUI DE PROPOSITO, como nas duas
// migrations de competencia anteriores: uma migration nao importa codigo de
// aplicacao (o CLI do knex carrega os .js um a um, sem o alias root/* e sem o .env
// que o Utils le no import) e, acima disso, uma migration e um fato datado - ela
// tem que continuar produzindo o mesmo resultado depois que a section for
// reescrita de novo.
export async function up(knex: Knex): Promise<void> {
    await rewriteCompetence(knex, (leg, index) => addMonths(leg.ExpenseDate, cycleShift(leg) - 1 + index))
}


// A volta e exata: a formula da migration anterior e esta sem a ancora, e o
// ExpenseDate esta ali inteiro.
export async function down(knex: Knex): Promise<void> {
    await rewriteCompetence(knex, (leg, index) => addMonths(leg.ExpenseDate, cycleShift(leg) + index))
}


// Qual fatura pegou a compra: 0 quando ela ainda pegou a que fecha no mes dela, 1
// quando passou do fechamento. A comparacao e entre duas datas reais e o setDay
// grampeia o dia que nao existe no mes curto.
const cycleShift = (leg: LegRow) => (leg.ExpenseDate <= setDay(leg.ExpenseDate, leg.ClosingDay!) ? 0 : 1)


/**
 * Reescreve a CompetenceDate das pernas de cartao em modo 'purchase' de gasto nao
 * cancelado, so nos cartoes que fecham na PRIMEIRA METADE do mes.
 *
 * Nao toca em 'invoice': la a competencia e o vencimento gravado na propria perna,
 * e o vencimento nao muda nesta etapa.
 */
async function rewriteCompetence(knex: Knex, compute: ComputeCompetence): Promise<void> {
    // to_char e nao a coluna crua: os pgTypeParsers do app nao sao registrados no
    // caminho do CLI, entao uma coluna `date` voltaria como Date de meia-noite
    // local - em UTC-3 o dia 01 vira o 31 do mes anterior.
    let legs = await knex("ExpensePayments")
        .select(
            "ExpensePayments.IdExpensePayment",
            knex.raw(`to_char("Expenses"."ExpenseDate", 'YYYY-MM-DD') as "ExpenseDate"`),
            "ExpensePayments.InstallmentNumber",
            "PaymentMethods.ClosingDay",
        )
        .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
        .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
        .where("PaymentMethods.Kind", "credit_card")
        .where("PaymentMethods.CompetenceMode", "purchase")
        .whereNotNull("PaymentMethods.ClosingDay")
        .where("PaymentMethods.ClosingDay", "<=", HALF_MONTH)
        .whereNot("Expenses.Status", "canceled") as LegRow[]

    for (let leg of legs) {
        // A primeira parcela e o indice 0; a perna a vista nao tem numero.
        let index = (leg.InstallmentNumber ?? 1) - 1

        await knex("ExpensePayments")
            .where("IdExpensePayment", leg.IdExpensePayment)
            .update({ CompetenceDate: compute(leg, index), UpdatedAt: knex.fn.now() })
    }
}


const HALF_MONTH = 15

const CALENDAR = "YYYY-MM-DD"

const toCalendar = (date: string) => moment(date, CALENDAR, true)

const addMonths = (date: string, months: number) => toCalendar(date).add(months, "months").format(CALENDAR)

// O dia que nao existe no mes curto e grampeado no ultimo dia dele: o `date()` do
// moment estouraria para o mes seguinte (31 de fevereiro viraria 03/03).
function setDay(date: string, day: number) {
    let target = toCalendar(date)

    return target.date(Math.min(day, target.daysInMonth())).format(CALENDAR)
}


interface LegRow {
    IdExpensePayment: number
    ExpenseDate: string
    InstallmentNumber: number | null
    ClosingDay: number | null
}

type ComputeCompetence = (leg: LegRow, index: number) => string
