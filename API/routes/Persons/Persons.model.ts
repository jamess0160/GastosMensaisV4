import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Quem recebeu ou quem gastou o dinheiro. Existe em vez de apontar o rateio para Users
//  porque **pessoa não precisa de login**: filho, cônjuge que não usa o app, sócio — todos
//  entram num rateio sem nunca terem uma senha.
//
//  Atenção ao IdUser: aqui ele é o **vínculo de identidade** (esta pessoa também é um usuário
//  do sistema), não a autoria da linha, que é o sentido dele em Accounts e Tags. Nulo é o
//  caso comum.
export class class_Persons_model extends BaseModel {

    //  Sem Position nesta tabela: a ordem é o nome mesmo, que é como a lista de rateio é lida.
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Persons>("Persons").where("Active", true).orderBy("Name").orderBy("IdPerson")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    //  O IdWorkspace entra junto com o IdPerson pelo mesmo motivo do Accounts.getUnique: o id
    //  da linha chega do cliente e é sequencial.
    getUnique(IdWorkspace: number, IdPerson: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdPerson", IdPerson).first()
    }

    //  Fora do baseQuery de propósito, como o getByEmailIncludingInactive de Users: o índice
    //  unique(IdWorkspace, Name) não conhece o Active, então a pessoa arquivada continua
    //  ocupando o nome. Sem enxergá-la, o cadastro de um nome repetido estouraria 500.
    //
    //  A comparação é case insensitive e o índice não é — ou seja, esta checagem é a mais
    //  estrita das duas, de propósito: "Maria" e "maria" no mesmo rateio são um erro de
    //  digitação, não duas pessoas. O lower() vai em raw, com o identificador entre aspas,
    //  porque no Postgres o nome da coluna é case sensitive.
    getByNameIncludingInactive(IdWorkspace: number, Name: string) {
        return this.KnexConnection
            .select("*")
            .from<Database.Persons>("Persons")
            .where("IdWorkspace", IdWorkspace)
            .whereRaw('lower("Name") = lower(?)', [Name])
            .first()
    }

    create(records: MaybeArray<Partial<Database.Persons>>) {
        return this.KnexConnection.insert(records).into("Persons")
    }

    update(IdPerson: number, record: Partial<Database.Persons>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Persons").where("IdPerson", IdPerson)
    }

    //  Soft delete: ExpensePersons aponta para cá com ON DELETE RESTRICT, e o rateio do gasto do
    //  mês passado tem que continuar apontando para quem de fato entrou nele.
    delete(IdPerson: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("Persons").where("IdPerson", IdPerson)
    }
}

export const Persons_model = new class_Persons_model()
