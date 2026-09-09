import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { class_ExpensePayments_model, ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { class_ExpensePersons_model, ExpensePersons_model } from "../../ExpensePersons.model"
import { class_ExpenseTags_model } from "../../ExpenseTags.model"
import { class_Expenses_model, Expenses_model } from "../../Expenses.model"
import { ResolveByName } from "root/routes/Tags/sections/POST/resolveByName"
import { ExpenseAxes } from "../ExpenseAxes.section"
import { ExpenseCategory } from "../ExpenseCategory.section"
import { ExpenseStatus } from "../ExpenseStatus.section"
import { InvoiceDates } from "../InvoiceDates.section"
import { ExpensesNamespace } from "../types"

//  Edita **um** gasto. Numa série fixa isso é uma ocorrência só — a série inteira tem rota
//  própria (PUT .../series), porque mexer no futuro é outra operação.
export class Update {
    public async run(SelectedIdWorkspace: number, IdExpense: number, IdUser: number, body: ExpensesNamespace.UpdateExpensePayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let expense = await Expenses_model.getUnique(IdWorkspace, IdExpense)

        if (!expense) {
            throw new APIError({
                msg: "Gasto não encontrado!",
                status: 406,
                data: { IdWorkspace, IdExpense },
            })
        }

        //  Cancelado é estado terminal: editar seria ressuscitar pela porta dos fundos.
        if (expense.Status === "canceled") {
            throw new APIError({
                msg: "Gasto cancelado não pode ser editado.",
                status: 406,
                data: { IdExpense },
            })
        }

        //  As parcelas são derivadas do total e da forma de pagamento: mexer nelas por aqui
        //  seria reparcelar sem dizer, e as faturas já lançadas mudariam de mês. Cancelar e
        //  lançar de novo é a operação honesta.
        if (expense.Kind === "installment" && body.Payments) {
            throw new APIError({
                msg: "As parcelas de uma compra parcelada não se editam: cancele e lance de novo.",
                status: 406,
                data: { IdExpense },
            })
        }

        //  O Kind não muda no PUT, então quem manda é o gravado: virar estorno uma ocorrência
        //  de série ou uma compra parcelada é a mesma recusa do cadastro.
        ExpenseAxes.assertSignAllowedForKind(expense.Kind, body.TotalValue)

        await ExpenseCategory.assertCategory(IdWorkspace, body.IdCategory)

        //  Os dois eixos são conferidos contra o **novo** total, com o que veio no corpo ou com
        //  o que está gravado: quando só o total muda, é o eixo antigo que deixa de fechar. É
        //  aqui que a compra parcelada com total novo é recusada, porque as 6 parcelas gravadas
        //  não somam mais o total.
        let payments = body.Payments ?? await this.storedPayments(IdExpense)
        let persons = body.Persons ?? await this.storedPersons(IdExpense)

        let methods = await ExpenseAxes.assertPayments(IdWorkspace, body.TotalValue, payments)
        await ExpenseAxes.assertPersons(IdWorkspace, body.TotalValue, persons)

        await KnexTransaction(async (tx) => {
            await new class_Expenses_model(tx).update(IdExpense, {
                Description: body.Description,
                TotalValue: body.TotalValue,
                IdCategory: body.IdCategory,
                ExpenseDate: body.ExpenseDate,
                Notes: body.Notes,
                //  Sem Kind e sem Status: o formato não muda depois de lançado, e o Status é
                //  derivado das pernas pelo ExpenseStatus.
            })

            //  Cada eixo é substituído inteiro, nunca remendado: é o que mantém as somas
            //  fechando — e é o que garante que os dois continuam sendo 2 + 2, nunca 4.
            if (body.Payments) {
                let ExpensePayments_model = new class_ExpensePayments_model(tx)

                await ExpensePayments_model.deleteByExpense(IdExpense)

                await ExpensePayments_model.create(body.Payments.map((payment) => {
                    let method = methods.get(payment.IdPaymentMethod)!

                    return {
                        IdWorkspace,
                        IdExpense,
                        IdPaymentMethod: payment.IdPaymentMethod,
                        Value: payment.Value,
                        //  Refeitas a partir da data nova: mudar a data da compra pode mudar a
                        //  fatura em que ela cai — e com ela a CompetenceDate. À vista, porque o
                        //  PUT não mexe em parcela: a compra parcelada é recusada logo acima.
                        ...InvoiceDates.forPayment(method, body.ExpenseDate),
                        //  A perna é substituída inteira, então o "entrou na fatura" recomeça —
                        //  a fatura pode ter mudado com a data nova, e a conferência é sobre a
                        //  fatura em que a perna caiu agora.
                        Charged: InvoiceDates.initialCharged(method),
                        Paid: Boolean(payment.Paid),
                    }
                }))
            }

            if (body.Persons) {
                let ExpensePersons_model = new class_ExpensePersons_model(tx)

                await ExpensePersons_model.deleteByExpense(IdExpense)

                if (body.Persons.length) {
                    await ExpensePersons_model.create(body.Persons.map((person) => ({ ...person, IdWorkspace, IdExpense })))
                }
            }

            if (body.Tags) {
                let ExpenseTags_model = new class_ExpenseTags_model(tx)

                await ExpenseTags_model.deleteByExpense(IdExpense)

                //  As tags chegam como texto e viram linhas aqui dentro: a que ainda não existe
                //  é criada, a que foi arquivada volta. O vínculo é refeito inteiro — a lista
                //  enviada é a lista final.
                let tags = await new ResolveByName(tx).run(IdWorkspace, IdUser, body.Tags)

                if (tags.length) {
                    await ExpenseTags_model.create(tags.map((IdTag) => ({ IdTag, IdWorkspace, IdExpense })))
                }
            }

            //  Trocar as pernas pode ter mudado o que está quitado: o Status é recalculado da
            //  fonte, na mesma transaction.
            await ExpenseStatus.refresh(IdWorkspace, IdExpense, tx)
        })

        return { msg: "Gasto atualizado com sucesso" }
    }

    private async storedPayments(IdExpense: number) {
        let stored = await ExpensePayments_model.getByExpense(IdExpense)

        return stored.map((payment) => ({ IdPaymentMethod: payment.IdPaymentMethod, Value: payment.Value, Paid: payment.Paid }))
    }

    private async storedPersons(IdExpense: number) {
        let stored = await ExpensePersons_model.getByExpense(IdExpense)

        return stored.map((person) => ({ IdPerson: person.IdPerson, Value: person.Value }))
    }
}
