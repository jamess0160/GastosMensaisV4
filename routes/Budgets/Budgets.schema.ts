import Joi from "joi"
import { joiController } from "root/Utils/joiController"
import { isoDate, referenceMonth } from "root/Utils/joiSchemas"
import { categoryResponse } from "root/routes/Categories/Categories.schema"
import { personResponse } from "root/routes/Persons/Persons.schema"

//  De quem é o teto. Derivado na resposta, e não deduzido pelo cliente a partir de qual id veio
//  nulo — o precedente é o `Balance` de GET /Accounts.
const scope = Joi.string().valid("category", "person")

//  O teto de um mês, do jeito que a tela lê: a linha congelada, o alvo e o comprometido.
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
    //  **Um dos dois é nulo, sempre** — o alvo é uma categoria OU uma pessoa. O `Scope` diz
    //  qual sem que o cliente tenha que olhar para os ids.
    Scope: scope.required(),
    IdCategory: Joi.number().allow(null).required(),
    //  A categoria inteira: é o nome e a cor dela que a tela desenha. Nula em orçamento de
    //  pessoa.
    Category: categoryResponse.allow(null).required(),
    IdPerson: Joi.number().allow(null).required(),
    //  A pessoa inteira, pelo mesmo motivo. Nula em orçamento de categoria.
    Person: personResponse.allow(null).required(),
    //  Quanto já foi comprometido no mês — ver sections/BudgetSpent.section.ts. Não é coluna:
    //  é calculado a cada leitura, como o saldo da conta. No orçamento de pessoa ele é
    //  **rateado pelas parcelas**, para dar o mesmo número que a categoria enxerga.
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
        //  **xor: exatamente um dos dois alvos.** Mandar os dois, ou nenhum, é 406 — e o
        //  BudgetTarget.section confere de novo antes de escrever, porque o CHECK do banco
        //  garantiria o mesmo, mas como 500.
        joiController.validateBody(Joi.object({
            IdCategory: Joi.number().optional(),
            //  O eixo **analítico** (ExpensePersons), nunca o financeiro: o orçamento de pessoa
            //  soma o que foi atribuído a ela, não o que saiu do cartão dela.
            IdPerson: Joi.number().optional(),
            ReferenceMonth: referenceMonth.required(),
            //  positive: teto zero é não ter teto, e isso se faz apagando o mês.
            LimitValue: Joi.number().precision(2).positive().required(),
            AlertPercent: Joi.number().integer().min(1).max(100).default(80),
            //  Sem Status: o mês nasce aberto e só a rotina, quando existir, o fecha.
        }).xor("IdCategory", "IdPerson")),
        joiController.validateResponse(Joi.object({
            IdBudget: Joi.number().required(),
            IdBudgetPeriod: Joi.number().required(),
        })),
    ]
}

export const Budgets_schema = new Schema()
