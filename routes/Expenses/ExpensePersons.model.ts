import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  **Eixo analítico: quem consumiu.** Não move saldo nenhum — é o espelho de InflowPersons.
//
//  Nunca confundir com ExpensePayments, que é o eixo financeiro: duas formas de pagamento e
//  duas pessoas geram **2 + 2 linhas, nunca 4**. Se o código produzir 4, o modelo foi entendido
//  errado. Por isso os dois eixos são montados em passos separados, cada um com o seu total.
//
//  Sem rota própria: é montado junto com o gasto e sai embutido no GET de um gasto só.
export class class_ExpensePersons_model extends BaseModel {

    getByExpense(IdExpense: number) {
        return this.KnexConnection.select("*").from<Database.ExpensePersons>("ExpensePersons").where("IdExpense", IdExpense).orderBy("IdExpensePerson")
    }

    create(records: MaybeArray<Partial<Database.ExpensePersons>>) {
        return this.KnexConnection.insert(records).into("ExpensePersons")
    }

    //  Substituído inteiro a cada edição, como o rateio da entrada: é o que garante que a soma
    //  continua fechando com o TotalValue depois do PUT.
    deleteByExpense(IdExpense: number) {
        return this.KnexConnection.from("ExpensePersons").where("IdExpense", IdExpense).delete()
    }
}

export const ExpensePersons_model = new class_ExpensePersons_model()
