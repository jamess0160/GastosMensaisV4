import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { class_ExpensePayments_model, ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { Database } from "root/Utils/database"
import { class_ExpensePersons_model, ExpensePersons_model } from "../../ExpensePersons.model"
import { class_Expenses_model } from "../../Expenses.model"
import { ExpenseAxes } from "../ExpenseAxes.section"
import { ExpenseCategory } from "../ExpenseCategory.section"
import { ExpenseSeries } from "../ExpenseSeries.section"
import { ExpenseStatus } from "../ExpenseStatus.section"
import { InvoiceDates } from "../InvoiceDates.section"
import { ExpensesNamespace } from "../types"

//  Edita a série fixa **da ocorrência escolhida para a frente**.
//
//  O aluguel que subiu em setembro não reescreve o que se pagou em agosto: as ocorrências
//  anteriores ficam exatamente como estão, e é isso que faz "quanto eu pagava em agosto" ter
//  resposta. O corte é a data da ocorrência em que a rota foi chamada — ver ExpenseSeries.
export class UpdateSeries {
    public async run(SelectedIdWorkspace: number, IdExpense: number, IdUser: number, body: ExpensesNamespace.UpdateSeriesPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let { forward } = await ExpenseSeries.resolve(IdWorkspace, IdExpense)

        if (!forward.length) {
            throw new APIError({
                msg: "Não há ocorrência nenhuma para editar a partir desta.",
                status: 406,
                data: { IdExpense },
            })
        }

        //  Série é sempre 'fixed', então o total negativo cai aqui: estorno é avulso.
        ExpenseAxes.assertSignAllowedForKind("fixed", body.TotalValue)

        await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)

        //  O eixo analítico vale para todas as ocorrências alcançadas, então é conferido uma
        //  vez contra o novo total.
        if (body.Persons) await ExpenseAxes.assertPersons(IdWorkspace, body.TotalValue, body.Persons)

        let legs = await this.resolveLegs(IdWorkspace, forward, body)

        await KnexTransaction(async (tx) => {
            let Expenses_model = new class_Expenses_model(tx)
            let ExpensePayments_model = new class_ExpensePayments_model(tx)
            let ExpensePersons_model = new class_ExpensePersons_model(tx)

            for (let occurrence of forward) {
                await Expenses_model.update(occurrence.IdExpense, {
                    Description: body.Description,
                    TotalValue: body.TotalValue,
                    IdCategory: body.IdCategory,
                    Notes: body.Notes,
                    //  A data de cada ocorrência não muda: mexer nela moveria o gasto de mês.
                })

                //  A perna única acompanha o total, com as datas de fatura refeitas a partir da
                //  data **daquela** ocorrência — cada uma cai na sua fatura.
                let leg = legs.get(occurrence.IdExpense)!

                //  O Paid não é tocado: a ocorrência que já foi paga continua paga pelo valor
                //  novo — quem quiser desfazer usa a rota de desquitar.
                await ExpensePayments_model.update(leg.IdExpensePayment, {
                    Value: body.TotalValue,
                    //  À vista: a ocorrência de uma série tem uma perna só, nunca parcela.
                    ...InvoiceDates.forPayment(leg.method, occurrence.ExpenseDate),
                })

                if (body.Persons) {
                    await ExpensePersons_model.deleteByExpense(occurrence.IdExpense)

                    if (body.Persons.length) {
                        await ExpensePersons_model.create(body.Persons.map((person) => ({ ...person, IdWorkspace, IdExpense: occurrence.IdExpense })))
                    }
                }

                await ExpenseStatus.refresh(IdWorkspace, occurrence.IdExpense, tx)
            }
        })

        return { msg: "Série atualizada com sucesso", Occurrences: forward.length }
    }

    //  Cada ocorrência alcançada precisa ter exatamente uma perna: é assim que o gasto fixo
    //  nasce, e é o que permite dizer "a perna vale o novo total" sem inventar rateio.
    //
    //  Se alguém editou uma ocorrência individualmente e a deixou com duas formas de pagamento,
    //  a série não adivinha como distribuir — recusa, dizendo qual ocorrência.
    private async resolveLegs(IdWorkspace: number, forward: Database.Expenses[], body: ExpensesNamespace.UpdateSeriesPayload) {
        let legs = new Map<number, { IdExpensePayment: number, method: Database.PaymentMethods }>()

        for (let occurrence of forward) {
            let payments = await ExpensePayments_model.getByExpense(occurrence.IdExpense)

            if (payments.length !== 1) {
                throw new APIError({
                    msg: "Uma ocorrência desta série foi editada à parte e tem mais de uma forma de pagamento: edite essa ocorrência sozinha.",
                    status: 406,
                    data: { IdExpense: occurrence.IdExpense, Payments: payments.length },
                })
            }

            //  Reusa a conferência dos eixos para o mesmo fim de sempre: a forma de pagamento
            //  continua sendo deste workspace e continua ativa.
            let methods = await ExpenseAxes.assertPayments(IdWorkspace, body.TotalValue, [
                { IdPaymentMethod: payments[0].IdPaymentMethod, Value: body.TotalValue },
            ])

            legs.set(occurrence.IdExpense, {
                IdExpensePayment: payments[0].IdExpensePayment,
                method: methods.get(payments[0].IdPaymentMethod)!,
            })
        }

        return legs
    }
}
