import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { PaymentMethodsNamespace } from "./types"

//  DueDay/ClosingOffsetDays decidem em qual fatura uma compra cai, e só fazem sentido em
//  cartão de crédito. O banco não tem CHECK para isso: um pix gravado com DueDay=10 passa na
//  inserção e só aparece lá na etapa 5, como uma data de vencimento em cima de um pagamento à
//  vista.
//
//  A regra vive num lugar só porque tem dois pontos de escrita e o Joi não cobre os dois: no
//  POST ele consegue usar o `when` sobre o Kind do body, mas no PUT o Kind que manda é o da
//  linha gravada, que o schema não enxerga.
const creditCardOnly = ["DueDay", "ClosingOffsetDays", "Brand", "LastDigits"] as const

class Controller {

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

        //  Em cartão, apagar vencimento ou folga de fechamento não é edição parcial: é deixar
        //  a compra sem fatura. Omitir mantém o que está gravado; mandar null é recusado.
        let cleared = (["DueDay", "ClosingOffsetDays"] as const).filter((field) => field in body && body[field] === null)

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
