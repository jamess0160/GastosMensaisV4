import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    //  Sem corpo: quitar é um verbo, não um cadastro. O que muda é só a perna do caminho, e o
    //  instante do pagamento é o servidor que grava.
    public readonly pay = [
        joiController.validateParams(Joi.object({
            IdExpensePayment: Joi.number().required(),
        })),
    ]

    public readonly unpay = this.pay
}

export const ExpensePayments_schema = new Schema()
