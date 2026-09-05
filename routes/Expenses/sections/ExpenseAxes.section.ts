import { PaymentMethods_model } from "root/routes/PaymentMethods/PaymentMethods.model"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { APIError } from "root/Utils/Logs"
import { Utils } from "root/Utils/Utils"
import { Database } from "root/Utils/database"
import { ExpensesNamespace } from "./types"

//  **Os dois eixos do gasto, que nunca se misturam.**
//
//      ExpensePayments -> eixo financeiro: por onde o dinheiro sai. É o que move saldo.
//      ExpensePersons  -> eixo analítico: de quem é o custo. Não move nada.
//
//  Duas formas de pagamento e duas pessoas geram **2 + 2 linhas, nunca 4**. Se algum dia este
//  arquivo produzir 4, o modelo foi entendido errado — os eixos são validados e montados em
//  passos separados justamente para que o produto cartesiano nunca tenha por onde aparecer.
//
//  Cada eixo fecha com o TotalValue por conta própria, e **o banco não garante nenhum dos
//  dois**. O eixo financeiro que não fecha faz o saldo divergir; o analítico que não fecha faz
//  todo relatório por pessoa mentir. Nenhum dos dois quebra nada na hora.
class Controller {

    //  Devolve as formas de pagamento conferidas, indexadas: quem chama precisa delas para
    //  calcular as datas de fatura, e buscar de novo lá seria uma segunda chance de esquecer o
    //  filtro de workspace.
    public async assertPayments(IdWorkspace: number, TotalValue: number, payments: ExpensesNamespace.PaymentPayload[]) {

        if (!payments.length) {
            throw new APIError({
                msg: "O gasto precisa de pelo menos uma forma de pagamento.",
                status: 406,
                data: { IdWorkspace },
            })
        }

        let ids = payments.map((payment) => payment.IdPaymentMethod)

        let methods = await PaymentMethods_model.getByWorkspace(IdWorkspace).whereIn("IdPaymentMethod", ids)

        let byId = new Map(methods.map((method) => [method.IdPaymentMethod, method]))

        //  Arquivada cai aqui junto com a de outro tenant: o getByWorkspace filtra Active, e
        //  lançar num cartão arquivado é lançar no que sumiu das listas de escolha.
        let missing = ids.filter((id) => !byId.has(id))

        if (missing.length) {
            throw new APIError({
                msg: "Forma de pagamento não encontrada!",
                status: 406,
                data: { IdWorkspace, missing },
            })
        }

        this.assertPaidOnlyOffCreditCard(payments, byId)

        this.assertClosesWithTotal(TotalValue, payments.map((payment) => payment.Value), "das formas de pagamento")

        return byId
    }

    //  **No cartão de crédito, `Paid` não vem do cliente.**
    //
    //  Marcar como paga uma perna de cartão no lançamento é dizer que o dinheiro saiu da conta —
    //  e ele não saiu: quem tira é o pagamento da fatura, semanas depois. Era exatamente isso
    //  que deixava o saldo errado, e o argumento não é de modelagem, é do mundo: **não se paga
    //  uma compra isolada da fatura.** Nenhum emissor oferece isso.
    //
    //  Fora do cartão o `Paid: true` no lançamento continua valendo, e é o caso comum: o débito
    //  e o pix saem no ato.
    private assertPaidOnlyOffCreditCard(payments: ExpensesNamespace.PaymentPayload[], byId: Map<number, Database.PaymentMethods>) {
        let invalid = payments.filter((payment) => payment.Paid && byId.get(payment.IdPaymentMethod)?.Kind === "credit_card")

        if (!invalid.length) return

        throw new APIError({
            msg: "Compra no cartão de crédito não nasce quitada: ela é quitada com a fatura.",
            status: 406,
            data: { invalid: invalid.map((payment) => payment.IdPaymentMethod) },
        })
    }

    //  O eixo analítico é opcional: gasto que não se reparte não precisa de rateio nenhum.
    //  Mas se vier, fecha com o total — meio rateio é pior que nenhum.
    public async assertPersons(IdWorkspace: number, TotalValue: number, persons: ExpensesNamespace.SplitPayload[]) {

        if (!persons.length) return

        let ids = persons.map((person) => person.IdPerson)

        //  unique(IdExpense, IdPerson) no banco: a mesma pessoa duas vezes estouraria 23505.
        if (new Set(ids).size !== ids.length) {
            throw new APIError({
                msg: "A mesma pessoa aparece duas vezes no rateio.",
                status: 406,
                data: { ids },
            })
        }

        let found = await Persons_model.getByWorkspace(IdWorkspace).whereIn("IdPerson", ids)

        if (found.length !== ids.length) {
            let byId = new Set(found.map((person: Database.Persons) => person.IdPerson))

            throw new APIError({
                msg: "Pessoa do rateio não encontrada!",
                status: 406,
                data: { IdWorkspace, missing: ids.filter((id) => !byId.has(id)) },
            })
        }

        this.assertClosesWithTotal(TotalValue, persons.map((person) => person.Value), "do rateio entre pessoas")
    }

    //  Em centavos: 0.1 + 0.2 em ponto flutuante não dá 0.3, e este `===` é o invariante.
    private assertClosesWithTotal(TotalValue: number, values: number[], what: string) {
        let total = Utils.toCents(TotalValue)
        let sum = values.reduce((acc, value) => acc + Utils.toCents(value), 0)

        if (sum === total) return

        throw new APIError({
            msg: `A soma ${what} precisa fechar exatamente com o valor do gasto.`,
            status: 406,
            data: { TotalValue, Sum: sum / 100 },
        })
    }
}

export const ExpenseAxes = new Controller()
