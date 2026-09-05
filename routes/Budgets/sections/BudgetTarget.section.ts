import { ExpenseCategory } from "root/routes/Expenses/sections/ExpenseCategory.section"
import { Persons_model } from "root/routes/Persons/Persons.model"
import { APIError } from "root/Utils/Logs"
import { BudgetsNamespace } from "./types"

//  **O alvo de um teto: uma categoria OU uma pessoa, nunca os dois.**
//
//  São duas perguntas diferentes sobre o mesmo dinheiro — "quanto foi de mercado" e "quanto foi
//  da Maria" —, e um gasto conta nos dois orçamentos sem que isso seja dupla contagem. O que
//  não se pode é somar os dois num total.
//
//  Os dois eixos do gasto reaparecem aqui: o orçamento de categoria olha o gasto inteiro, e o
//  de pessoa olha o eixo **analítico** (ExpensePersons), nunca o financeiro.
//
//  Segunda barreira depois do `xor` do Joi, como o PaymentMethodKind é depois do `when`: o
//  CHECK do banco garante a exclusividade, mas garantir com um 500 não é garantir. E o id chega
//  do cliente e é sequencial nos dois casos, então tem que ser visível a este workspace.
class Controller {

    public async assertTarget(IdWorkspace: number, body: BudgetsNamespace.CreateBudgetPayload) {

        if (body.IdCategory && body.IdPerson) {
            throw new APIError({
                msg: "Um orçamento é de uma categoria ou de uma pessoa, não dos dois.",
                status: 406,
                data: { IdCategory: body.IdCategory, IdPerson: body.IdPerson },
            })
        }

        if (body.IdCategory) {
            //  A mesma conferência do gasto: a categoria tem que ser visível a este workspace —
            //  a própria ou uma global.
            await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)

            return { IdCategory: body.IdCategory, IdPerson: null }
        }

        if (!body.IdPerson) {
            throw new APIError({
                msg: "Informe a categoria ou a pessoa do orçamento.",
                status: 406,
                data: { IdWorkspace },
            })
        }

        //  Arquivada cai aqui junto com a de outro tenant: o getUnique filtra Active, e orçar
        //  quem sumiu da lista de rateio é orçar um teto que nada mais alimenta.
        let person = await Persons_model.getUnique(IdWorkspace, body.IdPerson)

        if (!person) {
            throw new APIError({
                msg: "Pessoa não encontrada!",
                status: 406,
                data: { IdWorkspace, IdPerson: body.IdPerson },
            })
        }

        return { IdCategory: null, IdPerson: body.IdPerson }
    }
}

export const BudgetTarget = new Controller()
