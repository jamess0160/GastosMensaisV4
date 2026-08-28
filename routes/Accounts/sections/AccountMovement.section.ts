import { KnexConnection } from "root/Utils/Connections/Knex/KnexConnection"

//  "A conta já tem movimento?" — a pergunta que trava a edição do saldo de abertura.
//
//  Um lugar só, pelo mesmo motivo do saldo (decisão 1 do ROADMAP): são duas tabelas e duas
//  pontas de FK, e cada cópia dessa consulta espalhada é uma chance de esquecer uma delas —
//  esquecer a transferência que saiu, por exemplo, e liberar a troca do saldo de abertura de
//  uma conta que tem movimento.
class Controller {

    public async hasMovement(IdAccount: number) {
        let [inflow, payment] = await Promise.all([
            this.getFirstInflow(IdAccount),
            this.getFirstExpensePayment(IdAccount),
        ])

        return Boolean(inflow || payment)
    }

    //  As duas pontas: entrada que caiu na conta e transferência que saiu dela. O cancelado
    //  não conta — ele não move saldo nenhum, então não há histórico para proteger.
    private getFirstInflow(IdAccount: number) {
        return KnexConnection
            .select("IdInflow")
            .from("Inflows")
            .where((query) => query.where("IdToAccount", IdAccount).orWhere("IdFromAccount", IdAccount))
            .whereNot("Status", "canceled")
            .first()
    }

    //  Sem filtro de Active na subconsulta de PaymentMethods: a compra feita num cartão que
    //  depois foi arquivado continua sendo movimento da conta.
    private getFirstExpensePayment(IdAccount: number) {
        return KnexConnection
            .select("IdExpensePayment")
            .from("ExpensePayments")
            .whereIn("IdPaymentMethod", KnexConnection.select("IdPaymentMethod").from("PaymentMethods").where("IdAccount", IdAccount))
            .first()
    }
}

export const AccountMovement = new Controller()
