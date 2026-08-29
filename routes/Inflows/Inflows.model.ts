import { BaseModel, MaybeArray } from "root/Utils/Base"
import { Database } from "root/Utils/database"
import { InflowsNamespace } from "./sections/types"

//  Entrada de dinheiro **e** transferência entre contas, na mesma tabela, discriminadas pelo
//  Kind. Substitui a cashinflows do V3 e absorve a transferência.
//
//  **A regra que não pode ser esquecida:** transferência é soma zero para o patrimônio. Todo
//  total de "quanto entrou" precisa de `where Kind <> 'transfer'`, senão o mesmo dinheiro é
//  contado de novo a cada vez que muda de conta — e o número fica plausível. Não vale para o
//  saldo da conta, que conta as duas pontas (ver Accounts/sections/AccountBalance.section.ts):
//  são duas regras opostas sobre a mesma coluna.
//
//  Sem Active nesta tabela: o ciclo de vida é o Status, e cancelar é Status='canceled'.
export class class_Inflows_model extends BaseModel {

    //  Ordena pela competência, que é a data que o usuário enxerga na lista do mês.
    private readonly baseQuery = this.KnexConnection.select("*").from<Database.Inflows>("Inflows").orderBy("CompetenceDate").orderBy("IdInflow")

    //  O período (From/To) é o formato compartilhado com Expenses — ver Utils/joiSchemas.ts.
    //  Sem Status no filtro, a cancelada fica de fora: ela é lixo, não histórico.
    getByWorkspace(IdWorkspace: number, filters: InflowsNamespace.ListFilters = {}) {
        let query = this.baseQuery.clone().where("IdWorkspace", IdWorkspace)

        if (filters.From) query = query.where("CompetenceDate", ">=", filters.From)
        if (filters.To) query = query.where("CompetenceDate", "<=", filters.To)
        if (filters.Kind) query = query.where("Kind", filters.Kind)

        return filters.Status ? query.where("Status", filters.Status) : query.whereNot("Status", "canceled")
    }

    //  O IdWorkspace entra junto com o IdInflow pelo mesmo motivo do Accounts.getUnique: o id
    //  chega do cliente e é sequencial.
    getUnique(IdWorkspace: number, IdInflow: number) {
        return this.baseQuery.clone().where("IdWorkspace", IdWorkspace).where("IdInflow", IdInflow).first()
    }

    create(records: MaybeArray<Partial<Database.Inflows>>) {
        return this.KnexConnection.insert(records).into("Inflows")
    }

    update(IdInflow: number, record: Partial<Database.Inflows>) {
        return this.KnexConnection.update({ ...record, UpdatedAt: this.KnexConnection.fn.now() }).from("Inflows").where("IdInflow", IdInflow)
    }

    //  Recebimento é tudo ou nada: não existe ReceivedValue nem estado parcial.
    receive(IdInflow: number) {
        return this.update(IdInflow, { Status: "received", ReceivedAt: this.KnexConnection.fn.now() as unknown as Database.Inflows["ReceivedAt"] })
    }

    //  O "delete" da tabela. Não há Active aqui: cancelar é o estado terminal, e a linha fica
    //  para o histórico — o Inflows aponta para Accounts com ON DELETE RESTRICT dos dois lados.
    cancel(IdInflow: number) {
        return this.update(IdInflow, { Status: "canceled" })
    }
}

export const Inflows_model = new class_Inflows_model()
