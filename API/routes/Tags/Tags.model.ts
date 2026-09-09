import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  A taxonomia temporária, ao lado da permanente que é Categories: uma viagem, um evento, um
//  presente. Um gasto tem **uma** categoria e **N** tags — por isso Tags é uma tabela à parte
//  com uma tabela de vínculo (ExpenseTags), e não uma segunda coluna em Expenses.
//
//  **A tag não tem cadastro próprio: ela nasce junto com o gasto**, a partir do texto que o
//  usuário digitou. Por isso não há POST nem PUT — renomear uma tag mudaria a etiqueta de todos
//  os gastos já marcados, e quem quer outro nome digita outro nome no próximo gasto.
//
//  Atenção ao IdUser: aqui ele é a **autoria** da linha, como em Accounts — quem usou a tag
//  primeiro. Em Persons a mesma coluna significa outra coisa (o vínculo com um login).
export class class_Tags_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Tags>("Tags").where("Active", true).orderBy("Name").orderBy("IdTag")

    /** O input de sugestão. O teto existe porque isto responde a cada tecla digitada. */
    search(IdWorkspace: number, term?: string, limit = 20) {
        let query = this.baseQuery.clone().where("IdWorkspace", IdWorkspace).limit(limit)

        //  ILIKE é do Postgres e resolve o "sem diferenciar maiúscula" sem função na coluna. O
        //  % e o _ do termo são escapados: sem isso, digitar "%" listaria tudo.
        return term ? query.whereRaw('"Name" ilike ?', [`%${escapeLike(term)}%`]) : query
    }

    getUnique(IdWorkspace: number, IdTag: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdTag", IdTag).first()
    }

    //  Fora do baseQuery, e **sem o filtro de Active de propósito**: a tag marcada num gasto é
    //  histórico, não sugestão. Arquivar tira a etiqueta das próximas escolhas; se ela sumisse
    //  também da leitura do gasto, o soft delete não estaria comprando nada — a viagem do ano
    //  passado perderia o nome do mesmo jeito que perderia num delete físico.
    getByExpense(IdExpense: number) {
        return this.KnexConnection
            .select("*")
            .from<Database.Tags>("Tags")
            .whereIn("IdTag", this.KnexConnection.select("IdTag").from("ExpenseTags").where("IdExpense", IdExpense))
            .orderBy("Name")
    }

    //  Fora do baseQuery, e sem filtro de Active: o índice unique(IdWorkspace, Name) não conhece
    //  o Active, então a tag arquivada continua ocupando o nome. Quem resolve os nomes na
    //  criação do gasto precisa enxergá-la para reaproveitar a linha em vez de estourar 23505.
    //
    //  O lower() vai em raw com o identificador entre aspas, porque no Postgres o nome da coluna
    //  é case sensitive.
    getByNamesIncludingInactive(IdWorkspace: number, names: string[]) {
        return this.KnexConnection
            .select("*")
            .from<Database.Tags>("Tags")
            .where("IdWorkspace", IdWorkspace)
            .whereRaw(`lower("Name") in (${names.map(() => "?").join(", ")})`, names.map((name) => name.toLowerCase()))
    }

    create(records: MaybeArray<Partial<Database.Tags>>) {
        return this.KnexConnection.insert(records).into("Tags")
    }

    //  Só o Active volta ao ar: o nome é o que identifica a tag, e reusar a linha arquivada é o
    //  que impede um segundo "Viagem Chile" de existir.
    restore(ids: number[]) {
        return this.KnexConnection.update({ Active: true, UpdatedAt: this.KnexConnection.fn.now() }).from("Tags").whereIn("IdTag", ids)
    }

    //  Soft delete, e aqui ele pesa mais do que nas outras tabelas: ExpenseTags aponta para cá
    //  com ON DELETE **CASCADE**, então o delete físico não seria recusado — ele apagaria em
    //  silêncio o vínculo com todos os gastos já marcados, e a viagem do ano passado perderia
    //  a etiqueta sem ninguém perceber. Arquivar tira da sugestão e não toca no vínculo.
    delete(IdTag: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("Tags").where("IdTag", IdTag)
    }
}

//  O ILIKE trata % e _ como curinga: escapar deixa o termo ser lido como texto.
function escapeLike(term: string) {
    return term.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export const Tags_model = new class_Tags_model()
