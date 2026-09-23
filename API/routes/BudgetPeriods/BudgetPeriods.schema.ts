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
    //  é calculado a cada leitura, como o saldo da conta. **Cada porção de gasto consome uma
    //  fatia ou nenhuma**, nunca duas: o que não casou com nenhuma está no `Unbudgeted` do mês.
    Spent: Joi.number().required(),
})

//  **O mês inteiro é um envelope, não uma lista**, e quem obriga é o `Unbudgeted`: ele é do
//  mês, não de linha nenhuma. Ele é o preço da regra estrita ficar visível — se todo gasto for
//  carimbado com pessoa, as fatias só de categoria nunca consomem nada, e é aqui que isso
//  aparece em vez de sumir calado.
export const budgetMonthResponse = Joi.object({
    Periods: Joi.array().items(budgetPeriodResponse).required(),
    //  Pode vir negativo, como o `Spent`: um mês só de estornos fora das fatias.
    Unbudgeted: Joi.number().required(),
})

class Schema {

    public readonly getByMonth = [
        //  Aqui o mês é a unidade, ao contrário das listagens de movimento, que usam From/To:
        //  o orçamento é a repartição da renda de um mês civil.
        joiController.validateQuery(Joi.object({
            ReferenceMonth: referenceMonth.required(),
        })),
        joiController.validateResponse(budgetMonthResponse),
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

    //  **Repetir a repartição de um mês no outro.** Dois meses e nada mais: não há lista de
    //  itens no corpo, ao contrário do `POST /Inflows/batch` que a Renda usa para o mesmo
    //  gesto — ver sections/POST/clone.ts para o porquê da diferença.
    public readonly clone = [
        joiController.validateBody(Joi.object({
            From: referenceMonth.required(),
            //  **Clonar um mês nele mesmo é chamada montada errada**, e não um jeito
            //  complicado de não fazer nada: todo alvo já existe no destino, então a rota
            //  responderia 200 com lista vazia e esconderia o erro do cliente. É o mesmo
            //  cuidado do `min(1)` no lote da Renda.
            To: referenceMonth.required().invalid(Joi.ref("From")),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
            //  A mesma forma do lote da Renda: os ids voltam para o cliente invalidar o cache
            //  do mês certo, e o tamanho da lista é quantas linhas vieram.
            IdBudgetPeriods: Joi.array().items(Joi.number()).required(),
        })),
    ]

    //  **O rateio do mês inteiro numa escrita só** — o gesto da tela do orçamento.
    //
    //  O corpo é o mês DEPOIS da escrita, e não um lote de criações: ver
    //  sections/POST/allocate.ts. Nenhuma linha carrega `IdBudgetPeriod`, porque a identidade
    //  de uma fatia é o alvo — a mesma regra que faz o PUT recusar alvo no corpo.
    public readonly allocate = [
        joiController.validateBody(Joi.object({
            ReferenceMonth: referenceMonth.required(),
            //  **Lista vazia é aceita**, ao contrário do `min(1)` do lote da Renda: aqui ela
            //  quer dizer "este mês não tem orçamento", que é o usuário apagando todas as
            //  linhas e salvando. Lá a lista vazia não tinha o que significar.
            Lines: Joi.array().items(Joi.object({
                IdCategory: Joi.number().optional(),
                IdPerson: Joi.number().optional(),
                //  positive, como no POST de uma linha só: valor zero é não ter a fatia, e isso
                //  se faz tirando a linha da lista.
                LimitValue: Joi.number().precision(2).positive().required(),
                AlertPercent: Joi.number().integer().min(1).max(100).optional(),
                //  Mesmo `or` do POST: pelo menos um alvo, possivelmente os dois. O alvo
                //  repetido DENTRO da lista é 406 também, mas quem confere é a section — o Joi
                //  valida item a item e não enxerga o conjunto.
            }).or("IdCategory", "IdPerson")).required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
            //  A mesma forma do `clone`: os ids do mês depois da escrita, na ordem em que o
            //  corpo os mandou — que é a ordem da tela.
            IdBudgetPeriods: Joi.array().items(Joi.number()).required(),
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
