import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, referenceMonth } from "root/Utils/joiSchemas"
import { categoryResponse } from "root/routes/Categories/Categories.schema"

//  O teto de um mês, do jeito que a tela lê: a linha congelada, a categoria e o comprometido.
export const budgetPeriodResponse = Joi.object({
    IdBudgetPeriod: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    IdBudget: Joi.number().required(),
    //  Data de calendário: sempre o dia 1 do mês, como "YYYY-MM-01".
    ReferenceMonth: isoDate.required(),
    LimitValue: Joi.number().required(),
    AlertPercent: Joi.number().required(),
    //  Nasce 'open' e nada fecha ainda: fechar o mês é trabalho da rotina, que não existe.
    Status: Joi.string().valid("open", "closed").required(),
    ClosedAt: Joi.date().allow(null).required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
    IdCategory: Joi.number().required(),
    //  A categoria inteira: é o nome e a cor dela que a tela desenha.
    Category: categoryResponse.required(),
    //  Quanto já foi comprometido no mês — ver sections/BudgetSpent.section.ts. Não é coluna:
    //  é calculado a cada leitura, como o saldo da conta.
    Spent: Joi.number().required(),
})

class Schema {

    public readonly getByMonth = [
        //  Aqui o mês é a unidade, ao contrário das listagens de movimento, que usam From/To:
        //  um teto vale para o mês civil inteiro.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.required(),
        })),
        joiController.validateResponse(Joi.array().items(budgetPeriodResponse)),
    ]

    public readonly create = [
        joiController.validateBody(Joi.object({
            IdCategory: Joi.number().required(),
            ReferenceMonth: referenceMonth.required(),
            //  positive: teto zero é não ter teto, e isso se faz apagando o mês.
            LimitValue: Joi.number().precision(2).positive().required(),
            AlertPercent: Joi.number().integer().min(1).max(100).default(80),
            //  Sem Status: o mês nasce aberto e só a rotina, quando existir, o fecha.
        })),
        joiController.validateResponse(Joi.object({
            IdBudget: Joi.number().required(),
            IdBudgetPeriod: Joi.number().required(),
        })),
    ]
}

export const Budgets_schema = new Schema()
