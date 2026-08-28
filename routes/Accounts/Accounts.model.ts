import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

export class class_Accounts_model extends BaseModel {

    //  Ordena por Position antes do Id porque a ordem da lista é a que o usuário arrastou na
    //  tela. Position é nullable e no Postgres o nulo cai no fim do ASC, que é justamente
    //  onde a conta que nunca foi posicionada deve ficar.
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Accounts>("Accounts").where("Active", true).orderBy("Position").orderBy("IdAccount")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    //  O IdWorkspace entra na cláusula junto com o IdAccount, e não só no assertMember: o id
    //  da conta chega do cliente e é sequencial, então buscar apenas por ele leria a conta de
    //  outro tenant mesmo com a matrícula conferida.
    getUnique(IdWorkspace: number, IdAccount: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdAccount", IdAccount).first()
    }

    create(records: MaybeArray<Partial<Database.Accounts>>) {
        return this.KnexConnection.insert(records).into("Accounts")
    }

    update(IdAccount: number, record: Partial<Database.Accounts>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Accounts").where("IdAccount", IdAccount)
    }

    //  Soft delete. Inflows aponta para Accounts nas duas pontas com ON DELETE RESTRICT: o
    //  delete físico de uma conta com lançamento seria recusado pelo banco — e é para ser
    //  mesmo, porque o histórico precisa continuar apontando para a conta que foi usada.
    delete(IdAccount: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("Accounts").where("IdAccount", IdAccount)
    }
}

export const Accounts_model = new class_Accounts_model()
