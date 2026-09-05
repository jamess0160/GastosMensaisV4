import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  **A definição vigente de um teto** — quanto ele vale a partir de agora. Uma linha por alvo,
//  sem mês: mês é assunto de BudgetPeriods.
//
//  **O alvo é uma categoria OU uma pessoa**, nunca os dois (CHECK no banco, `xor` no schema).
//  Uma tabela só, e não uma PersonBudgets paralela, porque BudgetPeriods aponta para IdBudget:
//  a máquina inteira do mês — congelar o teto, o unique(IdBudget, ReferenceMonth), o PUT do
//  mês, o delete físico do período — passa a servir aos dois sem uma linha nova.
//
//  As duas são perguntas diferentes sobre o mesmo dinheiro ("quanto foi de mercado" e "quanto
//  foi da Maria"), então **um gasto conta nos dois orçamentos e isso não é dupla contagem**. O
//  que não se pode é somar os dois num total.
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

    //  O índice parcial unique(IdWorkspace, IdCategory) where IdCategory is not null: é por
    //  aqui que o cadastro do segundo mês reencontra a definição em vez de tentar criar outra
    //  e estourar 23505 como 500.
    getByCategory(IdWorkspace: number, IdCategory: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdCategory", IdCategory).first()
    }

    //  O espelho do getByCategory para o outro alvo, com o índice parcial gêmeo por trás. Duas
    //  buscas e não uma com o alvo genérico porque são duas colunas e dois índices: escondê-las
    //  atrás de um parâmetro só faria a chamada parecer intercambiável, e ela não é.
    getByPerson(IdWorkspace: number, IdPerson: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdPerson", IdPerson).first()
    }

    create(records: MaybeArray<Partial<Database.Budgets>>) {
        return this.KnexConnection.insert(records).into("Budgets")
    }

    update(IdBudget: number, record: Partial<Database.Budgets>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Budgets").where("IdBudget", IdBudget)
    }
}

export const Budgets_model = new class_Budgets_model()
