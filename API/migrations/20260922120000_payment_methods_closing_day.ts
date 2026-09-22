import type { Knex } from "knex";
import moment from "moment";


// O fechamento do cartao volta a ser um dia do mes, e desta vez sem a subtracao
// por baixo.
//
// O MODELO DA FOLGA ESTAVA ERRADO POR CONSTRUCAO. Ele descrevia o cartao por
// DueDay + ClosingOffsetDays e derivava o fechamento por subtracao, assumindo que
// o emissor fecha N dias antes de vencer. Ele nao fecha: fecha num dia fixo do
// mes. As duas descricoes coincidem em alguns meses e discordam nos outros,
// porque os meses tem tamanhos diferentes. No cartao que motivou a correcao -
// fecha 27, vence 04:
//
//     fatura que vence 04/09 -> 04/09 - 8 = 27/08   certo
//     fatura que vence 04/10 -> 04/10 - 8 = 26/09   ERRADO (o emissor fecha 27/09)
//     fatura que vence 04/11 -> 04/11 - 8 = 27/10   certo
//
// Quem cadastrava lendo a fatura de agosto gravava a folga certa para agosto e
// errada para setembro. E UM DIA DE ERRO NA DESCRICAO VIRA UM MES DE ERRO NO
// CAIXA: a compra de 27/09 era comparada contra um fechamento de 26/09, dada como
// perdida naquela fatura, e cobrada na de 04/11 em vez da de 04/10.
//
// Congelar as datas numa tabela de faturas nao resolveria: congelaria o resultado
// da mesma subtracao. Uma data errada guardada e uma data errada estavel.
//
// A RELACAO ENTRE OS DOIS DIAS e a unica coisa que o modelo novo infere, e ela e
// estavel porque compara dois dias NOMINAIS, nao duas datas de meses de tamanhos
// diferentes - que era exatamente o defeito da subtracao:
//
//     ClosingDay >  DueDay -> a fatura fecha no mes ANTERIOR ao do vencimento
//     ClosingDay <= DueDay -> fecha e vence no MESMO mes
//
// A ARITMETICA DE CALENDARIO ESTA COPIADA AQUI DE PROPOSITO. Ela e a mesma de
// routes/Expenses/sections/InvoiceDates.section.ts, mas uma migration nao importa
// codigo de aplicacao: o CLI do knex carrega os .js de build/migrations um a um,
// sem o alias root/* e sem o .env que o Utils carrega no import. E, acima disso,
// uma migration e um fato datado - ela tem que continuar produzindo o mesmo
// resultado depois que a section for reescrita de novo.
export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.smallint("ClosingDay").nullable()
    })

    // 1. OS CARTOES. O ClosingDay gravado e o dia do fechamento do ciclo DO MES
    //    DESTA MIGRATION, calculado pela formula velha. E uma conversao com
    //    perda, e nao ha como nao ser: a folga nao carrega a informacao de qual
    //    dos dois dias do mes era o certo, porque ela produz dias diferentes em
    //    meses diferentes. Por isso a leva entrega junto o aviso na tela do
    //    cartao - "confira o dia de fechamento com a sua fatura" - em vez de
    //    fingir que a conversao e exata.
    let cards = await knex("PaymentMethods")
        .select("IdPaymentMethod", "DueDay", "ClosingOffsetDays")
        .where("Kind", "credit_card")
        .whereNotNull("DueDay")
        .whereNotNull("ClosingOffsetDays") as OldCard[]

    let thisMonth = moment().format(CALENDAR)

    for (let card of cards) {
        let ClosingDay = dayOf(addDays(setDay(thisMonth, card.DueDay), -card.ClosingOffsetDays))

        await knex("PaymentMethods")
            .where("IdPaymentMethod", card.IdPaymentMethod)
            .update({ ClosingDay, UpdatedAt: knex.fn.now() })
    }

    // 2. AS PERNAS JA LANCADAS. Isto MOVE DINHEIRO ENTRE MESES no extrato e no
    //    saldo de quem ja lancou compra em cartao, e e o ponto: os numeros
    //    velhos estao errados. Paid, Charged, PaidAt e ChargedAt nao sao
    //    tocados - eles sao fato, nao derivacao.
    //
    //    Roda ANTES do dropColumn, e os dois sentidos fazem igual: o
    //    `rewriteLegs` le as duas colunas do cartao de uma vez so, e so ha um
    //    instante em que as duas existem lado a lado.
    await rewriteLegs(knex, (card, ExpenseDate, index) => {
        let monthsToClosing = ExpenseDate <= setDay(ExpenseDate, card.ClosingDay!) ? 0 : 1
        let closingMonth = addMonths(ExpenseDate, monthsToClosing + index)

        return {
            ClosingDate: setDay(closingMonth, card.ClosingDay!),
            DueDate: setDay(addMonths(closingMonth, monthShift(card)), card.DueDay),
        }
    })

    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("ClosingOffsetDays")
    })
}


// A volta e aproximada pelo mesmo motivo que a ida: a folga reconstruida e a
// distancia entre os dois dias NO MES DESTA MIGRATION, e ela vai errar por um dia
// nos meses de tamanho diferente - que e o defeito que fez a coluna sair. A folga
// e aparada no intervalo que o Joi antigo aceitava (1 a 28), porque um cartao que
// fecha 05 e vence 15 tem 10 dias de folga mas um que fecha 27 e vence 04 tem 8,
// e nada garante que a conta caia dentro da faixa em todo mes.
export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.smallint("ClosingOffsetDays").nullable()
    })

    let cards = await knex("PaymentMethods")
        .select("IdPaymentMethod", "DueDay", "ClosingDay")
        .where("Kind", "credit_card")
        .whereNotNull("DueDay")
        .whereNotNull("ClosingDay") as NewCard[]

    let thisMonth = moment().format(CALENDAR)

    for (let card of cards) {
        let due = setDay(thisMonth, card.DueDay)
        let closing = setDay(addMonths(due, -monthShift(card)), card.ClosingDay!)
        let ClosingOffsetDays = Math.min(28, Math.max(1, daysApart(closing, due)))

        await knex("PaymentMethods")
            .where("IdPaymentMethod", card.IdPaymentMethod)
            .update({ ClosingOffsetDays, UpdatedAt: knex.fn.now() })
    }

    // As pernas voltam a formula velha ANTES de a coluna nova sair, pelo mesmo
    // motivo do up: o `rewriteLegs` le as duas colunas juntas. E sem esta volta o
    // banco ficaria com as datas do modelo novo sendo lidas pelo antigo.
    await rewriteLegs(knex, (card, ExpenseDate, index) => {
        let dueOf = (months: number) => setDay(addMonths(ExpenseDate, months), card.DueDay)
        let closingOf = (months: number) => addDays(dueOf(months), -card.ClosingOffsetDays!)

        let monthsAhead = 0

        while (monthsAhead < 2 && ExpenseDate > closingOf(monthsAhead)) {
            monthsAhead++
        }

        return { ClosingDate: closingOf(monthsAhead + index), DueDate: dueOf(monthsAhead + index) }
    })

    await knex.schema.alterTable("PaymentMethods", (table) => {
        table.dropColumn("ClosingDay")
    })
}


/**
 * Reescreve ClosingDate, DueDate, CashDate e CompetenceDate de toda perna de
 * cartao de gasto nao cancelado, com as datas que a regra passada produz hoje.
 *
 * CashDate e sempre o vencimento - a perna de cartao sempre tem um. E a
 * CompetenceDate segue a regra QUE JA EXISTE: 'purchase' pesa no mes da compra
 * mais (n-1) meses e por isso nao muda aqui; 'invoice' pesa no vencimento e muda
 * junto com ele. A formula da competencia do modo 'purchase' e outra etapa.
 */
async function rewriteLegs(knex: Knex, compute: ComputeDates): Promise<void> {
    // to_char e nao a coluna crua: os pgTypeParsers do app nao sao registrados no
    // caminho do CLI, entao uma coluna `date` voltaria como Date de meia-noite
    // local - em UTC-3 o dia 01 vira o 31 do mes anterior.
    let legs = await knex("ExpensePayments")
        .select(
            "ExpensePayments.IdExpensePayment",
            knex.raw(`to_char("Expenses"."ExpenseDate", 'YYYY-MM-DD') as "ExpenseDate"`),
            "ExpensePayments.InstallmentNumber",
            "PaymentMethods.DueDay",
            "PaymentMethods.ClosingDay",
            "PaymentMethods.ClosingOffsetDays",
            "PaymentMethods.CompetenceMode",
        )
        .innerJoin("Expenses", "Expenses.IdExpense", "ExpensePayments.IdExpense")
        .innerJoin("PaymentMethods", "PaymentMethods.IdPaymentMethod", "ExpensePayments.IdPaymentMethod")
        .where("PaymentMethods.Kind", "credit_card")
        .whereNot("Expenses.Status", "canceled")
        .whereNotNull("PaymentMethods.DueDay") as LegRow[]

    for (let leg of legs) {
        // A primeira parcela e o indice 0; a perna a vista nao tem numero.
        let index = (leg.InstallmentNumber ?? 1) - 1
        let { ClosingDate, DueDate } = compute(leg, leg.ExpenseDate, index)

        await knex("ExpensePayments")
            .where("IdExpensePayment", leg.IdExpensePayment)
            .update({
                ClosingDate,
                DueDate,
                CashDate: DueDate,
                CompetenceDate: leg.CompetenceMode === "purchase" ? addMonths(leg.ExpenseDate, index) : DueDate,
                UpdatedAt: knex.fn.now(),
            })
    }
}


// A relacao entre os dois dias: fechando depois do dia de vencer, a fatura so
// pode ser cobrada no mes seguinte ao que ela fechou.
function monthShift(card: { DueDay: number, ClosingDay: number | null }) {
    return card.ClosingDay! > card.DueDay ? 1 : 0
}


const CALENDAR = "YYYY-MM-DD"

const toCalendar = (date: string) => moment(date, CALENDAR, true)

const addMonths = (date: string, months: number) => toCalendar(date).add(months, "months").format(CALENDAR)

const addDays = (date: string, days: number) => toCalendar(date).add(days, "days").format(CALENDAR)

const dayOf = (date: string) => toCalendar(date).date()

const daysApart = (from: string, to: string) => toCalendar(to).diff(toCalendar(from), "days")

// O dia que nao existe no mes curto e grampeado no ultimo dia dele: o `date()` do
// moment estouraria para o mes seguinte (31 de fevereiro viraria 03/03).
function setDay(date: string, day: number) {
    let target = toCalendar(date)

    return target.date(Math.min(day, target.daysInMonth())).format(CALENDAR)
}


interface OldCard {
    IdPaymentMethod: number
    DueDay: number
    ClosingOffsetDays: number
}

interface NewCard {
    IdPaymentMethod: number
    DueDay: number
    ClosingDay: number
}

interface LegRow {
    IdExpensePayment: number
    ExpenseDate: string
    InstallmentNumber: number | null
    DueDay: number
    ClosingDay: number | null
    ClosingOffsetDays: number | null
    CompetenceMode: "invoice" | "purchase" | null
}

type ComputeDates = (card: LegRow, ExpenseDate: string, index: number) => { ClosingDate: string, DueDate: string }
