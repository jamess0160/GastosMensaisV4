import type { Knex } from "knex";
import moment from "moment";


// A compra do cartao passa a pesar no mes do CICLO em que ela caiu, e nao no da
// data da compra.
//
// O MODO 'purchase' ESTAVA DECIDINDO O MES PELA PESSOA ERRADA. Ele escrevia
// CompetenceDate = ExpenseDate + (n-1) meses, ou seja, o mes da compra. Num
// cartao que fecha dia 30:
//
//     compra de 29/08 -> pesa em agosto   certo (esta na fatura de agosto)
//     compra de 30/08 -> pesa em agosto   certo (comprou NO dia do fechamento)
//     compra de 31/08 -> pesa em agosto   ERRADO
//     compra de 01/09 -> pesa em setembro certo
//
// A fatura de agosto fechou no dia 30. A compra de 31/08 nao esta nela, nao vai
// ser cobrada com ela, e mesmo assim consumia o orcamento de agosto e aparecia no
// relatorio de agosto. O outro modo nao resolve: 'invoice' faz a compra pesar no
// mes do VENCIMENTO, e a fatura que pega o gasto de 31/08 so vence em outubro. Os
// dois modos erravam este caso em direcoes opostas.
//
// A CORRECAO E UM DESLOCAMENTO DE CICLO:
//
//     cycleShift     = dia(ExpenseDate) > ClosingDay ? 1 : 0
//     CompetenceDate = ExpenseDate + (cycleShift + index) meses
//
// A linha cai DEPOIS do dia do fechamento: a compra feita no proprio dia em que a
// fatura fecha ainda e daquela fatura.
//
// O DIA DA COMPRA E PRESERVADO, e o mes e que anda. Gravar o proprio ClosingDate
// daria o mesmo mes e arruinaria o unico lugar que le a competencia como dia - o
// grafico diario do Relatorio -, empilhando o mes inteiro num pico no dia 30. E o
// `addMonths` do moment grampeia: 31/08 + 1 mes e 30/09, nunca 03/10.
//
// SO A CompetenceDate E REESCRITA AQUI. ClosingDate, DueDate e CashDate ja foram
// recalculadas pela migration do ClosingDay (20260922120000), e cada migration
// desfaz exatamente o que fez. Paid, Charged, PaidAt e ChargedAt nao sao tocados:
// eles sao fato, nao derivacao. Isto MOVE GASTO ENTRE MESES no orcamento e no
// relatorio de quem ja lancou compra em cartao depois do fechamento, e e o ponto -
// os numeros velhos estao errados. O saldo nao se mexe em nenhum sentido: quem o
// corta e a CashDate.
//
// A ARITMETICA DE CALENDARIO ESTA COPIADA AQUI DE PROPOSITO, como na migration
// anterior: uma migration nao importa codigo de aplicacao (o CLI do knex carrega
// os .js um a um, sem o alias root/* e sem o .env que o Utils le no import) e,
// acima disso, uma migration e um fato datado - ela tem que continuar produzindo o
// mesmo resultado depois que a section for reescrita de novo.
export async function up(knex: Knex): Promise<void> {
    await rewriteCompetence(knex, (leg, index) => {
        let cycleShift = leg.ExpenseDate <= setDay(leg.ExpenseDate, leg.ClosingDay!) ? 0 : 1

        return addMonths(leg.ExpenseDate, cycleShift + index)
    })
}


// A volta e exata, diferente da migration anterior: a formula velha nao depende de
// nada que tenha sido perdido, e o ExpenseDate esta ali inteiro.
export async function down(knex: Knex): Promise<void> {
    await rewriteCompetence(knex, (leg, index) => addMonths(leg.ExpenseDate, index))
}


/**
 * Reescreve a CompetenceDate de toda perna de cartao em modo 'purchase' de gasto
 * nao cancelado.
 *
 * Nao toca em 'invoice': la a competencia e o vencimento gravado na propria
 * perna, e o vencimento nao muda nesta etapa.
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
        .whereNot("Expenses.Status", "canceled") as LegRow[]

    for (let leg of legs) {
        // A primeira parcela e o indice 0; a perna a vista nao tem numero.
        let index = (leg.InstallmentNumber ?? 1) - 1

        await knex("ExpensePayments")
            .where("IdExpensePayment", leg.IdExpensePayment)
            .update({ CompetenceDate: compute(leg, index), UpdatedAt: knex.fn.now() })
    }
}


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
