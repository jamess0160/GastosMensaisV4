import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, referenceMonth } from "root/Utils/joiSchemas"

class Schema {

    public readonly getMonth = [
        //  Mês, e não From/To como nas listagens de movimento: os agregados do Dashboard são de
        //  um mês civil, e as duas pontas do cálculo (a abertura e o saldo) são **posições**.
        //  Opcional porque a tela abre no mês corrente — mesma regra de GET /Accounts.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.optional(),
        })),
        joiController.validateResponse(Joi.object({
            /** Normalizado para o dia 1, como o ReferenceMonth do orçamento */
            ReferenceMonth: isoDate.required(),
            /** O saldo realizado no fim do mês anterior — a abertura do "posso gastar" */
            OpeningBalance: Joi.number().required(),
            /** Entradas com competência no mês, pendentes e recebidas, sem transferência */
            Inflows: Joi.number().required(),
            /** Pernas com competência no mês, pendentes e pagas */
            Expenses: Joi.number().required(),
            /** Entradas de meses anteriores nunca recebidas */
            OverdueReceivable: Joi.number().required(),
            /** Pernas de meses anteriores nunca pagas */
            OverduePayable: Joi.number().required(),
            /** "Quanto ainda posso gastar" — a fórmula inteira */
            Available: Joi.number().required(),
            /** "Quanto tenho em conta" — a soma dos Balance das contas ativas no mês */
            CurrentBalance: Joi.number().required(),
            /** Quanto do saldo já tem dono: fatura vencendo no mês e ainda não paga */
            OpenInvoices: Joi.number().required(),
        })),
    ]
}

export const Reports_schema = new Schema()
