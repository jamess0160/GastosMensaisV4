import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  **Uma fatia da renda de um mês.** Não existe mais definição perene por trás: `Budgets`
//  morreu na leva 9, e com ela o "para sempre" que amarrava o orçamento a um teto eterno. Cada
//  linha aqui é o que o usuário escreveu para aquele mês, e é a única coisa que ele escreve.
//
//  **O alvo mora nesta tabela, em duas colunas anuláveis com um CHECK de pelo menos um** — o
//  oposto do `xor` que `Budgets` impunha. Três formatos: só categoria, só pessoa, e os dois
//  juntos ("250 para o Tiago em alimentação"). Cada formato tem o seu índice parcial único
//  sobre `(IdWorkspace, ReferenceMonth, …)`: são três e não um porque `NULL` não conflita com
//  `NULL` num índice único do Postgres, e uma `unique` sobre as quatro colunas deixaria passar
//  duas linhas `(sem pessoa, Mercado)`.
//
//  **As linhas somam lado a lado.** "Luana 250" e "Luana + Mercado 100" dão 350 para a Luana:
//  não há aninhamento nem teto dentro de teto — a soma de todas as linhas é o quanto do mês foi
//  alocado, que é o número que fecha contra a renda.
//
//  `ReferenceMonth` é `date` e guarda sempre o dia 1: é isso que faz os três índices barrarem
//  duas linhas do mesmo mês em vez de deixá-las conviver por causa de um dia diferente.
export class class_BudgetPeriods_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.BudgetPeriods>("BudgetPeriods").orderBy("IdBudgetPeriod")

    //  O orçamento de um mês inteiro, do workspace. É o que a tela do mês lê — e **qualquer**
    //  mês responde, passado, corrente ou futuro: nada aqui nasce de rotina.
    getByMonth(IdWorkspace: number, ReferenceMonth: string) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("ReferenceMonth", ReferenceMonth)
    }

    //  Escopado por workspace pelo mesmo motivo de sempre: o id chega do cliente e é sequencial.
    getUnique(IdWorkspace: number, IdBudgetPeriod: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdBudgetPeriod", IdBudgetPeriod).first()
    }

    //  **A linha exata de um alvo num mês**, e é por ela que o POST responde 406 em vez de
    //  deixar o índice parcial estourar 23505 como 500.
    //
    //  `whereNull` e não `where(coluna, null)`: em SQL `= NULL` nunca casa, e o alvo ausente é
    //  justamente o que distingue um formato do outro. Sem isso, "só Mercado" e "Maria em
    //  Mercado" pareceriam a mesma linha para esta busca.
    getByTarget(IdWorkspace: number, ReferenceMonth: string, IdCategory: number | null, IdPerson: number | null) {
        let query = this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("ReferenceMonth", ReferenceMonth)

        IdCategory === null ? query.whereNull("IdCategory") : query.where("IdCategory", IdCategory)
        IdPerson === null ? query.whereNull("IdPerson") : query.where("IdPerson", IdPerson)

        return query.first()
    }

    //  **Mês fechado não aceita escrita**, e é esta consulta que responde se ele fechou. Basta
    //  uma linha `closed`: a rotina fecha o mês inteiro de uma vez, então "alguma" e "todas"
    //  são a mesma coisa. E um mês **sem linha nenhuma** não está fechado — nunca foi montado,
    //  então não houve o que encerrar, e montá-lo agora é o caminho normal.
    getClosedInMonth(IdWorkspace: number, ReferenceMonth: string) {
        return this.baseQuery.clone()
            .where("IdWorkspace", IdWorkspace)
            .where("ReferenceMonth", ReferenceMonth)
            .where("Status", "closed")
            .first()
    }

    create(records: MaybeArray<Partial<Database.BudgetPeriods>>) {
        return this.KnexConnection.insert(records).into("BudgetPeriods")
    }

    update(IdBudgetPeriod: number, record: Partial<Database.BudgetPeriods>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod)
    }

    //  **Fecha o mês inteiro de um workspace** — escrita exclusiva da rotina do dia 1º, que é
    //  quem sabe que um mês acabou; nenhuma rota fecha período.
    //
    //  O `where Status = 'open'` não é otimização: é ele que faz rodar de novo não reescrever o
    //  ClosedAt de quem já fechou, e é dessa convergência que o catch-up do motor depende.
    closeMonth(IdWorkspace: number, ReferenceMonth: string) {
        return this.KnexConnection
            .update({ Status: "closed", ClosedAt: this.KnexConnection.fn.now(), UpdatedAt: this.KnexConnection.fn.now() })
            .from("BudgetPeriods")
            .where("IdWorkspace", IdWorkspace)
            .where("ReferenceMonth", ReferenceMonth)
            .where("Status", "open")
    }

    //  Delete físico, ao contrário de toda tabela de cadastro: a linha é **plano**, não
    //  lançamento. Nada aponta para ela, nenhum dinheiro passou por ela, e "não quero orçar
    //  mercado em setembro" não é histórico que valha guardar.
    delete(IdBudgetPeriod: number) {
        return this.KnexConnection.from("BudgetPeriods").where("IdBudgetPeriod", IdBudgetPeriod).delete()
    }
}

export const BudgetPeriods_model = new class_BudgetPeriods_model()
