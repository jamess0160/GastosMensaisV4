import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { periodQuery } from "root/Utils/joiSchemas"
import { expensePaymentResponse, expensePersonResponse, expenseResponse } from "root/routes/Expenses/Expenses.schema"

class Schema {

    public readonly getByWorkspace = [
        //  From/To é o formato de período compartilhado com Inflows e Expenses
        //  (Utils/joiSchemas.ts) — o que muda aqui é **qual data** ele compara: a da perna, não
        //  a da compra. Ver ExpensePayments.model.getByPeriod.
        joiController.validateQuery(Joi.object({
            ...periodQuery,
            //  A mesma regra de GET /Expenses: sem ele o cancelado fica de fora. As duas listas
            //  do mesmo mês não podem discordar sobre o que contêm.
            IncludeCanceled: Joi.boolean().default(false),
        })),
        //  A perna, o gasto de onde ela saiu e o rateio dele. A **forma de pagamento sai como
        //  id**, não inteira: ela já chega ao cliente completa dentro de GET /Accounts, e
        //  repeti-la em cada perna repetiria a mesma linha dezenas de vezes na resposta de um mês.
        joiController.validateResponse(Joi.array().items(expensePaymentResponse.keys({
            Expense: expenseResponse.required(),
            //  **O rateio é o do gasto, não o da perna** — as seis parcelas de uma compra
            //  trazem o mesmo rateio do total. Ver sections/GET/getByWorkspace.ts.
            Persons: Joi.array().items(expensePersonResponse).required(),
        }))),
    ]

    //  Sem corpo: quitar é um verbo, não um cadastro. O que muda é só a perna do caminho, e o
    //  instante do pagamento é o servidor que grava.
    public readonly pay = [
        joiController.validateParams(Joi.object({
            IdExpensePayment: Joi.number().required(),
        })),
    ]

    public readonly unpay = this.pay

    //  Mesma forma do pay: um verbo sobre a perna do caminho, sem corpo.
    public readonly charge = this.pay

    public readonly uncharge = this.pay
}

export const ExpensePayments_schema = new Schema()
