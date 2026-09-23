import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, referenceMonth } from "root/Utils/joiSchemas"
import { categoryResponse } from "root/routes/Categories/Categories.schema"
import { personResponse } from "root/routes/Persons/Persons.schema"

//  Uma fatia da renda do mês, do jeito que a tela lê: a linha, o alvo e o comprometido.
export const budgetPeriodResponse = Joi.object({
    IdBudgetPeriod: Joi.number().required(),
    IdWorkspace: Joi.number().required(),
    //  Data de calendário: sempre o dia 1 do mês, como "YYYY-MM-01".
    ReferenceMonth: isoDate.required(),
    LimitValue: Joi.number().required(),
    AlertPercent: Joi.number().required(),
    //  Nasce 'open'; quem carimba 'closed' é a rotina do dia 1º, e mês fechado recusa escrita.
    Status: Joi.string().valid("open", "closed").required(),
    ClosedAt: Joi.date().allow(null).required(),
    CreatedAt: Joi.date().required(),
    UpdatedAt: Joi.date().required(),
    //  **Pelo menos um dos dois, possivelmente os dois.** Não há `Scope`: com três formatos de
    //  alvo, um discriminador de dois valores mentiria — o que a tela lê é o par preenchido.
    IdCategory: Joi.number().allow(null).required(),
    //  A categoria inteira: é o nome e a cor dela que a tela desenha.
    Category: categoryResponse.allow(null).required(),
    IdPerson: Joi.number().allow(null).required(),
    //  A pessoa inteira, pelo mesmo motivo.
    Person: personResponse.allow(null).required(),
    //  Quanto já foi comprometido no mês — ver sections/BudgetSpent.section.ts. Não é coluna:
    //  é calculado a cada leitura, como o saldo da conta.
    Spent: Joi.number().required(),
})

class Schema {

    public readonly getByMonth = [
        //  Aqui o mês é a unidade, ao contrário das listagens de movimento, que usam From/To:
        //  o orçamento é a repartição da renda de um mês civil.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.required(),
        })),
        joiController.validateResponse(Joi.array().items(budgetPeriodResponse)),
    ]

    public readonly create = [
        //  **`or`, não `xor`: pelo menos um alvo, possivelmente os dois.** É a inversão que a
        //  leva 9 trouxe — "250 para o Tiago em alimentação" é uma fatia legítima, e o `xor`
        //  antigo a proibia. Sem alvo nenhum continua sendo 406, e o BudgetTarget.section
        //  confere de novo antes de escrever, porque o CHECK do banco garantiria o mesmo — mas
        //  como 500.
        joiController.validateBody(Joi.object({
            IdCategory: Joi.number().optional(),
            //  O eixo **analítico** (ExpensePersons), nunca o financeiro: a fatia de uma pessoa
            //  soma o que foi atribuído a ela, não o que saiu do cartão dela.
            IdPerson: Joi.number().optional(),
            ReferenceMonth: referenceMonth.required(),
            //  positive: valor zero é não ter a fatia, e isso se faz apagando a linha.
            LimitValue: Joi.number().precision(2).positive().required(),
            AlertPercent: Joi.number().integer().min(1).max(100).default(80),
            //  Sem Status: a linha nasce aberta e só a rotina do dia 1º a fecha.
        }).or("IdCategory", "IdPerson")),
        joiController.validateResponse(Joi.object({
            IdBudgetPeriod: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdBudgetPeriod: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            LimitValue: Joi.number().precision(2).positive().required(),
            AlertPercent: Joi.number().integer().min(1).max(100).optional(),
            //  Sem ReferenceMonth e sem alvo: mudar qualquer um dos dois moveria a fatia de
            //  lugar, e mover é apagar esta e cadastrar outra.
        })),
    ]

    public readonly remove = [
        joiController.validateParams(Joi.object({
            IdBudgetPeriod: Joi.number().required(),
        })),
    ]
}

export const BudgetPeriods_schema = new Schema()
