import { Knex } from "knex"
import { class_ExpensePayments_model } from "root/routes/ExpensePayments/ExpensePayments.model"
import { class_Expenses_model } from "../Expenses.model"

//  **O único lugar que escreve Expenses.Status.**
//
//  O Status é derivado das pernas de ExpensePayments: 'paid' só quando **todas** estão pagas,
//  'pending' até lá. Não existe estado parcial no gasto — a compra em 6x com 3 parcelas quitadas
//  continua 'pending', e é a perna que sabe quais já foram.
//
//  Nunca pode ser editado direto por rota, e é por isso que ele mora aqui em vez de virar uma
//  linha solta em cada section: são quatro pontos de escrita (criar, editar, quitar, desquitar)
//  e o único jeito de os quatro concordarem é recalcular a partir da mesma fonte.
class Controller {

    //  Recebe o IdWorkspace já conferido pela section que chamou, e o repassa para o getUnique:
    //  nem esta leitura interna escapa do escopo do tenant.
    public async refresh(IdWorkspace: number, IdExpense: number, tx?: Knex.Transaction) {
        let Expenses_model = new class_Expenses_model(tx)

        let expense = await Expenses_model.getUnique(IdWorkspace, IdExpense)

        //  Cancelado é estado terminal: recalcular aqui ressuscitaria como 'pending' o gasto
        //  que alguém acabou de cancelar.
        if (!expense || expense.Status === "canceled") return

        let payments = await new class_ExpensePayments_model(tx).getByExpense(IdExpense)

        //  Gasto sem perna nenhuma não está pago: `every` sobre lista vazia é true, e sem esta
        //  guarda um gasto sem eixo financeiro nasceria quitado.
        let Status = payments.length > 0 && payments.every((payment) => payment.Paid) ? "paid" as const : "pending" as const

        if (Status === expense.Status) return

        await Expenses_model.update(IdExpense, { Status })
    }
}

export const ExpenseStatus = new Controller()
