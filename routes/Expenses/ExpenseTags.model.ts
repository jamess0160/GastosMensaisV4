import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  O vínculo entre o gasto e as tags: um gasto tem **uma** categoria e **N** tags.
//
//  Sem rota própria — é montado junto com o gasto, então é um segundo model desta pasta, como
//  WorkspaceMembers. A tabela é ExpenseTags e não um vínculo genérico para que as entradas
//  possam ganhar InflowTags depois sem mexer em Tags.
//
//  Não há leitura aqui: quem lê é o Tags_model.getByExpense, que devolve a tag inteira. O
//  vínculo sozinho, sem o nome, não serve para nada na tela.
export class class_ExpenseTags_model extends BaseModel {

    create(records: MaybeArray<Partial<Database.ExpenseTags>>) {
        return this.KnexConnection.insert(records).into("ExpenseTags")
    }

    deleteByExpense(IdExpense: number) {
        return this.KnexConnection.from("ExpenseTags").where("IdExpense", IdExpense).delete()
    }
}

//  Sem singleton: as duas escritas acontecem dentro da transaction do gasto, então o model é
//  sempre construído com o tx.
