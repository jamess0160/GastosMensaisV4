import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  **A definição vigente do teto de uma categoria** — quanto vale a partir de agora. Uma linha
//  por categoria, sem mês: mês é assunto de BudgetPeriods.
//
//  A separação em duas tabelas é o que permite as três coisas que uma tabela só não dava:
//  responder "em março meu teto de mercado era 800", mudar o teto sem reescrever o passado, e
//  ajustar um mês sozinho ("em dezembro pode 1.500").
//
//  **Nesta leva a definição é escrita pelo cadastro mensal**, não por rotina: cada vez que o
//  usuário orça uma categoria, esta linha passa a valer o teto informado e o mês vira uma linha
//  em BudgetPeriods. Quando a rotina existir, é daqui que ela vai materializar o mês novo — e
//  aí o `Active` desta tabela ganha o sentido de "parar de orçar", que hoje nada lê.
export class class_Budgets_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Budgets>("Budgets").where("Active", true).orderBy("IdBudget")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    //  unique(IdWorkspace, IdCategory): é por aqui que o cadastro do segundo mês reencontra a
    //  definição em vez de tentar criar outra e estourar 23505 como 500.
    getByCategory(IdWorkspace: number, IdCategory: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdCategory", IdCategory).first()
    }

    create(records: MaybeArray<Partial<Database.Budgets>>) {
        return this.KnexConnection.insert(records).into("Budgets")
    }

    update(IdBudget: number, record: Partial<Database.Budgets>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Budgets").where("IdBudget", IdBudget)
    }
}

export const Budgets_model = new class_Budgets_model()
