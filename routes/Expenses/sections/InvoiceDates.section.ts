import { Database } from "root/Utils/database"
import { Utils } from "root/Utils/Utils"

//  Quando o dinheiro sai — e, no cartão, em qual fatura a compra cai.
//
//  As datas vivem na **perna**, não no gasto, porque cada parcela vence no seu mês. Section
//  própria porque o parcelamento reusa a mesma conta: **um dia de diferença na compra vira um
//  mês de diferença no caixa**, e essa regra não pode ter duas cópias.
//
//  Toda a aritmética é sobre "YYYY-MM-DD" (Utils.addMonthsToDate/addDaysToDate, moment por
//  baixo), nunca sobre Date solto — em UTC-3 o dia 01 viraria o 31 do mês anterior.
class Controller {

    /**
     * A perna à vista: uma forma de pagamento, o valor inteiro.
     *
     * Só o cartão tem fatura. Em pix e débito o dinheiro sai no ato, então não há fechamento
     * nem vencimento a marcar — a data do gasto já diz tudo.
     */
    public forPayment(paymentMethod: Database.PaymentMethods, ExpenseDate: string) {
        if (!this.isCreditCard(paymentMethod)) {
            return { ClosingDate: null, DueDate: null }
        }

        return this.creditCardInvoice(paymentMethod, ExpenseDate, 0)
    }

    /**
     * A parcela `index` (0 = a primeira) de uma compra parcelada.
     *
     * **Parcelar não é privilégio do cartão:** carnê, crediário e o racha com um amigo caem em
     * pix ou débito e mesmo assim têm parcela mensal. Fora do cartão não existe fatura, então
     * o fechamento fica nulo — mas o **vencimento existe**, e é o mesmo dia dos meses seguintes
     * a partir da compra. Sem ele não haveria como responder quanto vence em novembro.
     */
    public forInstallment(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        if (!this.isCreditCard(paymentMethod)) {
            return { ClosingDate: null, DueDate: Utils.addMonthsToDate(ExpenseDate, index) }
        }

        return this.creditCardInvoice(paymentMethod, ExpenseDate, index)
    }

    /**
     * **O vencimento é a âncora; o fechamento nasce dele.** É assim que o emissor funciona — o
     * cliente escolhe o dia de vencer e o banco fecha a fatura N dias antes — e é o que deixa
     * as duas datas sempre coerentes entre si.
     *
     * Guardar o fechamento como dia do mês custava dois defeitos que a folga não tem. O dia 30
     * precisava ser grampeado em fevereiro, enquanto a comparação que decide a fatura seguia
     * usando o nominal: as duas metades da regra passavam a falar de datas diferentes. E a
     * rolagem do vencimento tinha que ser **inferida** de dois números soltos, porque o modelo
     * não guardava a relação entre eles — aqui ela é a própria subtração.
     */
    private creditCardInvoice(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        //  Regra do fechamento: a compra entra na **primeira fatura que ainda não fechou**. É a
        //  linha que separa a compra do dia 20 da do dia 21 num cartão que fecha no 20 — e agora
        //  são duas datas reais sendo comparadas, não um dia nominal contra uma data grampeada.
        //  Em "YYYY-MM-DD" a ordem lexicográfica é a ordem cronológica, que é o motivo de o
        //  formato ser esse.
        //
        //  O laço existe porque **uma rolagem só nem sempre basta**: quando a folga é grande
        //  perto do dia de vencer, a fatura que vence no mês seguinte também já fechou (vence
        //  no dia 5 com folga de 7 e a compra é do dia 27 — a de março fechou em 26/02). Duas
        //  rodadas sempre bastam, e é o teto de 28 dias da folga no Joi que garante isso: a
        //  fatura de dois meses à frente fecha, no pior caso, no dia seguinte ao último dia do
        //  mês da compra.
        let monthsAhead = 0

        while (monthsAhead < 2 && ExpenseDate > this.closingOf(paymentMethod, ExpenseDate, monthsAhead)) {
            monthsAhead++
        }

        return {
            ClosingDate: this.closingOf(paymentMethod, ExpenseDate, monthsAhead + index),
            DueDate: this.dueOf(paymentMethod, ExpenseDate, monthsAhead + index),
        }
    }

    /**
     * O vencimento `monthsAhead` meses depois da compra.
     *
     * Sempre contado **a partir da data da compra**, nunca encadeado no vencimento anterior: o
     * `setDayOfMonth` depois do `addMonthsToDate` desfaz o arrasto do grampeamento. Vencendo no
     * dia 31, a parcela de fevereiro cai no 28 — e a de março tem que voltar ao 31, o que só
     * acontece porque o 28 nunca vira a nova âncora.
     */
    private dueOf(paymentMethod: Database.PaymentMethods, ExpenseDate: string, monthsAhead: number) {
        return Utils.setDayOfMonth(Utils.addMonthsToDate(ExpenseDate, monthsAhead), paymentMethod.DueDay!)
    }

    //  O fechamento é o vencimento menos a folga, e nada mais. Nunca grampeia, porque uma
    //  contagem de dias corridos sempre cai num dia que existe.
    private closingOf(paymentMethod: Database.PaymentMethods, ExpenseDate: string, monthsAhead: number) {
        return Utils.addDaysToDate(this.dueOf(paymentMethod, ExpenseDate, monthsAhead), -paymentMethod.ClosingOffsetDays!)
    }

    //  Cartão sem vencimento ou sem folga de fechamento não existe (o PaymentMethodKind
    //  garante), mas a checagem das duas colunas é o que deixa o `!` acima honesto.
    private isCreditCard(paymentMethod: Database.PaymentMethods) {
        return paymentMethod.Kind === "credit_card" && Boolean(paymentMethod.DueDay) && Boolean(paymentMethod.ClosingOffsetDays)
    }
}

export const InvoiceDates = new Controller()
