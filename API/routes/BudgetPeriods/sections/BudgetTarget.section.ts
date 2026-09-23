import { ExpenseCategory } from "root/routes/Expenses/sections/ExpenseCategory.section"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { APIError } from "root/Utils/Logs"
import { BudgetPeriodsNamespace } from "./types"

//  **O alvo de uma fatia: pelo menos uma categoria ou uma pessoa, possivelmente as duas.**
//
//  Era um `xor` até a leva 9 — uma categoria OU uma pessoa, nunca os dois — e a inversão é o
//  ponto inteiro da etapa: "250 para o Tiago **em alimentação**" é uma fatia legítima da renda
//  do mês, e o `CHECK` antigo a proibia. O que continua proibido é a linha **sem alvo nenhum**:
//  um valor que não diz do que é não soma contra coisa nenhuma.
//
//  Os dois eixos do gasto reaparecem aqui: a categoria olha o gasto inteiro, e a pessoa olha o
//  eixo **analítico** (ExpensePersons), nunca o financeiro.
//
//  Segunda barreira depois do `or` do Joi, como o PaymentMethodKind é depois do `when`: o CHECK
//  do banco garante a presença de um alvo, mas garantir com um 500 não é garantir. E os dois
//  ids chegam do cliente e são sequenciais, então têm que ser visíveis a este workspace.
class Controller {

    public async assertTarget(IdWorkspace: number, body: BudgetPeriodsNamespace.CreateBudgetPeriodPayload) {

        if (!body.IdCategory && !body.IdPerson) {
            throw new APIError({
                msg: "Informe a categoria, a pessoa, ou as duas.",
                status: 406,
                data: { IdWorkspace },
            })
        }

        if (body.IdCategory) {
            //  A mesma conferência do gasto: a categoria tem que ser deste workspace.
            await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)
        }

        if (body.IdPerson) {
            //  Arquivada cai aqui junto com a de outro tenant: o getUnique filtra Active, e
            //  orçar quem sumiu da lista de rateio é orçar uma fatia que nada mais alimenta.
            let person = await Persons_model.getUnique(IdWorkspace, body.IdPerson)

            if (!person) {
                throw new APIError({
                    msg: "Pessoa não encontrada!",
                    status: 406,
                    data: { IdWorkspace, IdPerson: body.IdPerson },
                })
            }
        }

        //  `?? null` e não `undefined`: é o que vai para a coluna, e o índice parcial só
        //  reconhece o formato da linha pelo `NULL` que ela tem.
        return {
            IdCategory: body.IdCategory ?? null,
            IdPerson: body.IdPerson ?? null,
        } satisfies BudgetPeriodsNamespace.BudgetTargetPayload
    }
}

export const BudgetTarget = new Controller()
