import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { PaymentMethodsNamespace } from "./types"

//  **As regras do Kind, num lugar só** — quais campos existem em cada um, e em que tipo de
//  conta cada um pode nascer.
//
//  DueDay/ClosingDay decidem em qual fatura uma compra cai, e só fazem sentido em
//  cartão de crédito. O banco não tem CHECK para isso: um pix gravado com DueDay=10 passa na
//  inserção e só aparece lá na etapa 5, como uma data de vencimento em cima de um pagamento à
//  vista.
//
//  A regra vive num lugar só porque tem dois pontos de escrita e o Joi não cobre os dois: no
//  POST ele consegue usar o `when` sobre o Kind do body, mas no PUT o Kind que manda é o da
//  linha gravada, que o schema não enxerga.
//  A lista encolheu com a saída de Brand e LastDigits, mas não sumiu: DueDay,
//  ClosingDay e CompetenceMode continuam sendo campos exclusivos de cartão que o banco
//  não protege. O CompetenceMode entrou pelo mesmo argumento dos outros dois: fora do cartão
//  não existe defasagem entre consumo e pagamento, então não há dois meses entre os quais
//  escolher — um pix com CompetenceMode='invoice' seria um valor sem significado nenhum.
const creditCardOnly = ["DueDay", "ClosingDay", "CompetenceMode"] as const

class Controller {

    //  **Só conta corrente aceita cartão de crédito.**
    //
    //  'cash' e 'card' são contas de saldo fechado — dinheiro na carteira e vale-alimentação —
    //  e uma fatura nelas não teria de onde sair: o cartão de crédito é uma dívida que vence
    //  contra uma conta bancária, e é isso que 'checking' significa no modelo.
    //
    //  É regra nova para o 'cash' também, e não só para o 'card' que acabou de nascer: até
    //  aqui nada impedia um credit_card numa conta de dinheiro, e fazer a regra valer para um
    //  e não para o outro a deixaria arbitrária — a razão é a mesma nos dois.
    //
    //  Só a criação precisa da checagem: o corpo do PUT não tem Kind nem IdAccount, então não
    //  há segunda porta por onde um cartão entre numa conta que não o aceita. E linha que já
    //  existe continua valendo — um cartão criado antes numa conta 'cash' não é apagado nem
    //  migrado, porque gasto lançado aponta para ele.
    public assertAccountAcceptsKind(account: Database.Accounts, Kind: Database.PaymentMethods["Kind"]) {

        if (Kind !== "credit_card" || account.Type === "checking") return

        throw new APIError({
            msg: "Cartão de crédito só existe em conta corrente.",
            status: 406,
            data: { IdAccount: account.IdAccount, Type: account.Type, Kind },
        })
    }

    public assertKindFields(Kind: Database.PaymentMethods["Kind"], body: PaymentMethodsNamespace.CreditCardFields) {

        if (Kind !== "credit_card") {
            let invalid = creditCardOnly.filter((field) => body[field] !== undefined && body[field] !== null)

            if (invalid.length) {
                throw new APIError({
                    msg: `Os campos ${invalid.join(", ")} só existem em cartão de crédito.`,
                    status: 406,
                    data: { Kind, invalid },
                })
            }

            return
        }

        //  Em cartão, apagar vencimento, dia de fechamento ou modo de competência não é
        //  edição parcial: é deixar a compra sem fatura, ou sem mês em que pesar. Omitir mantém
        //  o que está gravado; mandar null é recusado.
        let cleared = creditCardOnly.filter((field) => field in body && body[field] === null)

        if (cleared.length) {
            throw new APIError({
                msg: `Cartão de crédito não pode ficar sem ${cleared.join(" e ")}.`,
                status: 406,
                data: { Kind, cleared },
            })
        }
    }
}

export const PaymentMethodKind = new Controller()
