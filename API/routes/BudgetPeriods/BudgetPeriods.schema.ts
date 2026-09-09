import Joi from "joi"
import { joiController } from "root/Utils/joiController"

class Schema {

    //  Sem GET: o mês sai na leitura do orçamento (GET /Budgets), que é onde ele significa
    //  alguma coisa — com a categoria e o comprometido ao lado.
    public readonly update = [
        joiController.validateParams(Joi.object({
            IdBudgetPeriod: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            LimitValue: Joi.number().precision(2).positive().required(),
            AlertPercent: Joi.number().integer().min(1).max(100).optional(),
            //  Sem ReferenceMonth e sem IdBudget: mudar qualquer um dos dois moveria o teto de
            //  lugar, e mover é apagar este e cadastrar outro.
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdBudgetPeriod: Joi.number().required(),
        })),
    ]
}

export const BudgetPeriods_schema = new Schema()
