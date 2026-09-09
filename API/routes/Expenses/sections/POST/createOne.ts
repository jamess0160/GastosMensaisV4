import { Knex } from "knex"
import { class_ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { Database } from "root/Utils/database"
import { class_ExpensePersons_model } from "../../ExpensePersons.model"
import { class_ExpenseTags_model } from "../../ExpenseTags.model"
import { class_Expenses_model } from "../../Expenses.model"
import { ExpenseStatus } from "../ExpenseStatus.section"
import { Installments } from "../Installments.section"
import { InvoiceDates } from "../InvoiceDates.section"
import { ExpensesNamespace } from "../types"

//  Escreve **um** gasto completo: a linha, as pernas, o rateio e as tags.
//
//  Section própria e não um método privado do Create porque ela tem dois chamadores — o gasto
//  avulso e cada ocorrência de uma série — e porque a montagem das pernas (que é onde mora o
//  parcelamento) é assunto dela, não do orquestrador.
//
//  Recebe a transaction, como o CreateDefaults das formas de pagamento: um gasto sem perna, ou
//  com perna e sem o rateio, é meio lançamento.
export class CreateOne {

    private readonly tx: Knex.Transaction

    constructor(tx: Knex.Transaction) {
        this.tx = tx
    }

    public async run(IdWorkspace: number, IdUser: number, body: ExpensesNamespace.CreateExpensePayload, options: CreateOneOptions) {
        let IdExpense = await new class_Expenses_model(this.tx).create({
            IdWorkspace,
            //  Autoria do lançamento; o dono do dado é o workspace.
            IdUser,
            Description: body.Description,
            TotalValue: body.TotalValue,
            IdCategory: body.IdCategory,
            ExpenseDate: options.ExpenseDate,
            Kind: body.Kind,
            Notes: body.Notes,
            //  Só as ocorrências geradas de uma série apontam para a raiz. Nunca vem do cliente.
            IdParentExpense: options.IdParentExpense ?? null,
            //  Só a raiz da série carrega a recorrência.
            RecurrenceDay: options.recurrence?.RecurrenceDay ?? null,
            RecurrenceEndDate: options.recurrence?.RecurrenceEndDate ?? null,
            //  Status nunca vem do corpo: quem o escreve é o ExpenseStatus, a partir das pernas.
        }).returnId("IdExpense")

        await new class_ExpensePayments_model(this.tx).create(
            this.buildPayments(body, options).map((payment) => ({ ...payment, IdWorkspace, IdExpense })),
        )

        if (body.Persons.length) {
            await new class_ExpensePersons_model(this.tx).create(body.Persons.map((person) => ({ ...person, IdWorkspace, IdExpense })))
        }

        //  Os ids já vêm resolvidos: quem transformou o texto digitado em tag foi o Create, uma
        //  vez só para a série inteira.
        if (options.tags.length) {
            await new class_ExpenseTags_model(this.tx).create(options.tags.map((IdTag) => ({ IdTag, IdWorkspace, IdExpense })))
        }

        //  Na mesma transaction das pernas: o Status derivado não pode existir um instante em
        //  desacordo com a fonte de onde ele sai.
        await ExpenseStatus.refresh(IdWorkspace, IdExpense, this.tx)

        return IdExpense
    }

    //  O eixo financeiro. Em 'installment' a perna única vira N parcelas; nos outros formatos é
    //  uma linha por forma de pagamento.
    private buildPayments(body: ExpensesNamespace.CreateExpensePayload, options: CreateOneOptions) {

        if (body.Kind === "installment") {
            let [payment] = body.Payments
            let method = options.methods.get(payment.IdPaymentMethod)!

            //  A sobra de centavos vai na primeira parcela — ver Installments.section.ts.
            return Installments.split(body.TotalValue, body.InstallmentTotal!).map((Value, index) => ({
                IdPaymentMethod: payment.IdPaymentMethod,
                Value,
                InstallmentNumber: index + 1,
                InstallmentTotal: body.InstallmentTotal!,
                //  Cada parcela vence um mês depois da anterior — na fatura, se for cartão. Sai
                //  daqui também a CompetenceDate, o mês em que a parcela pesa.
                ...InvoiceDates.forInstallment(method, options.ExpenseDate, index),
                //  Nulo fora do cartão: não há fatura em que a cobrança possa entrar.
                Charged: InvoiceDates.initialCharged(method),
                //  Parcela nasce em aberto: quitar é perna a perna (ou, no cartão, pela fatura).
                Paid: false,
            }))
        }

        return body.Payments.map((payment) => {
            let method = options.methods.get(payment.IdPaymentMethod)!

            return {
                IdPaymentMethod: payment.IdPaymentMethod,
                Value: payment.Value,
                InstallmentNumber: null,
                InstallmentTotal: null,
                //  Nulas fora do cartão: pix e débito saem na hora, não têm fatura.
                ...InvoiceDates.forPayment(method, options.ExpenseDate),
                Charged: InvoiceDates.initialCharged(method),
                //  No cartão o Paid nunca vem do corpo — o ExpenseAxes recusa antes de chegar
                //  aqui, e quem o escreve é o payInvoice.
                Paid: options.forceUnpaid ? false : Boolean(payment.Paid),
            }
        })
    }
}

export interface CreateOneOptions {
    ExpenseDate: string
    /** As formas de pagamento já conferidas pelo ExpenseAxes, para não buscar de novo aqui. */
    methods: Map<number, Database.PaymentMethods>
    /** Os ids das tags, já resolvidos a partir do texto. */
    tags: number[]
    /** Preenchido só nas ocorrências geradas de uma série fixa. */
    IdParentExpense?: number
    /** A ocorrência do mês que vem não nasce quitada, por mais que a raiz tenha nascido. */
    forceUnpaid?: boolean
    recurrence?: { RecurrenceDay: number, RecurrenceEndDate: string | null }
}
