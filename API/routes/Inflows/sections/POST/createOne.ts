import { Knex } from "knex"
import { class_Inflows_model } from "../../Inflows.model"
import { InflowsNamespace } from "../types"

//  O miolo da criação: uma entrada (ou transferência), dentro de uma transaction que **vem de
//  fora**.
//
//  Existe separado do POST/create.ts pelo mesmo motivo de Workspaces/sections/POST/create.ts:
//  para o lote poder chamá-lo N vezes dentro de uma transaction só. O avulso é "abre transaction e chama uma vez"; o lote, "abre transaction
//  e chama N vezes" — e é isso que faz os N itens caírem ou passarem juntos.
//
//  **Não confere nada.** InflowKind.assertAccounts roda antes, fora da transaction, de
//  propósito: o caminho de erro não deve segurar conexão. No lote isso vale em dobro — os N
//  itens são conferidos primeiro, e uma transaction só é aberta se todos passarem.
//
//  Nasce sempre 'pending': receber é uma ação à parte (POST .../receive), porque é o
//  recebimento que move o saldo. É também o que torna o lote seguro de repetir — nada de
//  dinheiro se move na gravação.
export class CreateOne {

    private readonly Inflows_model: class_Inflows_model

    constructor(tx: Knex.Transaction) {
        this.Inflows_model = new class_Inflows_model(tx)
    }

    public async run(IdWorkspace: number, IdUser: number, body: InflowsNamespace.CreateInflowPayload) {
        return await this.Inflows_model.create({
            ...body,
            IdWorkspace,
            //  Autoria do lançamento; o dono do dado é o workspace.
            IdUser,
            //  Em 'inflow' o dinheiro veio de fora: a coluna existe, mas fica nula.
            IdFromAccount: body.Kind === "transfer" ? body.IdFromAccount : null,
        }).returnId("IdInflow")
    }
}
