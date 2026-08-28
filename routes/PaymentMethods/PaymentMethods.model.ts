import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"

//  Filha de Accounts, e o único lugar onde pix, débito e cartão de crédito existem: não há
//  tabela de cartões nem conta do tipo 'credit_card'. Model próprio porque é outra tabela,
//  mas mora dentro de routes/Accounts — cartão sem conta não existe.
export class class_PaymentMethods_model extends BaseModel {

    private readonly baseQuery = this.KnexConnection.select("*").from<Database.PaymentMethods>("PaymentMethods").where("Active", true).orderBy("Position").orderBy("IdPaymentMethod")

    getByWorkspace(IdWorkspace: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace)
    }

    getByAccount(IdAccount: number) {
        return this.baseQuery.clone().where("IdAccount", IdAccount)
    }

    //  Escopado por workspace pelo mesmo motivo do Accounts.getUnique: o id vem do cliente.
    getUnique(IdWorkspace: number, IdPaymentMethod: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdPaymentMethod", IdPaymentMethod).first()
    }

    create(records: MaybeArray<Partial<Database.PaymentMethods>>) {
        return this.KnexConnection.insert(records).into("PaymentMethods")
    }

    update(IdPaymentMethod: number, record: Partial<Database.PaymentMethods>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("PaymentMethods").where("IdPaymentMethod", IdPaymentMethod)
    }

    //  Soft delete: ExpensePayments aponta para cá com ON DELETE RESTRICT, então apagar de
    //  verdade um cartão com compra lançada é recusado pelo banco. Arquivar tira das listas
    //  sem mexer no que já foi lançado.
    delete(IdPaymentMethod: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("PaymentMethods").where("IdPaymentMethod", IdPaymentMethod)
    }

    //  Arquivar a conta arquiva as formas de pagamento dela na mesma transaction: um pix que
    //  sobrevive à conta continuaria aparecendo como opção de pagamento de uma conta sumida.
    deleteByAccount(IdAccount: number) {
        return this.KnexConnection.update({ Active: false, UpdatedAt: this.KnexConnection.fn.now() }).from("PaymentMethods").where("IdAccount", IdAccount)
    }
}

export const PaymentMethods_model = new class_PaymentMethods_model()
