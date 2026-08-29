import { Database } from "root/Utils/database"
import { Utils } from "root/Utils/Utils"

//  Quando o dinheiro sai — e, no cartão, em qual fatura a compra cai.
//
//  As datas vivem na **perna**, não no gasto, porque cada parcela vence no seu mês. Section
//  própria porque o parcelamento reusa a mesma conta: **um dia de diferença na compra vira um
//  mês de diferença no caixa**, e essa regra não pode ter duas cópias.
//
//  Toda a aritmética é sobre "YYYY-MM-DD" (Utils.addMonthsToDate, moment por baixo), nunca
//  sobre Date solto — em UTC-3 o dia 01 viraria o 31 do mês anterior.
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

    //  Regra do fechamento: comprou até o dia do fechamento, cai na fatura que fecha neste mês;
    //  comprou depois, já é a do mês seguinte. É a linha que separa a compra do dia 20 da do
    //  dia 21 num cartão que fecha no 20.
    private creditCardInvoice(paymentMethod: Database.PaymentMethods, ExpenseDate: string, index: number) {
        let purchaseDay = Number(ExpenseDate.split("-")[2])

        let closingMonth = purchaseDay <= paymentMethod.ClosingDay! ? 0 : 1

        let ClosingDate = Utils.setDayOfMonth(Utils.addMonthsToDate(ExpenseDate, closingMonth + index), paymentMethod.ClosingDay!)

        //  O vencimento é depois do fechamento: quando o dia de vencer é menor ou igual ao de
        //  fechar, ele já é do mês seguinte — cartão que fecha no 28 e vence no 5 vence em
        //  março a fatura que fechou em fevereiro.
        let dueMonth = paymentMethod.DueDay! > paymentMethod.ClosingDay! ? 0 : 1

        return {
            ClosingDate,
            DueDate: Utils.setDayOfMonth(Utils.addMonthsToDate(ClosingDate, dueMonth), paymentMethod.DueDay!),
        }
    }

    //  Cartão sem fechamento ou vencimento não existe (o PaymentMethodKind garante), mas a
    //  checagem das duas colunas é o que deixa o `!` acima honesto.
    private isCreditCard(paymentMethod: Database.PaymentMethods) {
        return paymentMethod.Kind === "credit_card" && Boolean(paymentMethod.ClosingDay) && Boolean(paymentMethod.DueDay)
    }
}

export const InvoiceDates = new Controller()
