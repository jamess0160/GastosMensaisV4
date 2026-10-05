import { Knex } from "knex"
import { Database } from "root/Utils/database"
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
//  **Nasce 'pending' ou 'received'**, conforme o `Received` do corpo — e no lote ele é sempre
//  false (ver Inflows.schema.ts), o que mantém a clonagem do mês segura de repetir: nada de
//  dinheiro se move na gravação de um lote. O `Status` em si não vem do corpo em nenhum dos
//  dois caminhos: 'canceled' no nascimento não é lançamento nenhum.
//
//  O estado é escrito **aqui, direto**, sem passar pela POST/receive.ts: as três checagens dela
//  — cancelada, já recebida, desfazer o que não foi recebido — são todas impossíveis numa linha
//  que está nascendo, e rotear a criação por ela pagaria três consultas de estado para um
//  registro cujo estado acabou de ser escrito duas linhas acima.
export class CreateOne {

    private readonly tx: Knex.Transaction
    private readonly Inflows_model: class_Inflows_model

    constructor(tx: Knex.Transaction) {
        this.tx = tx
        this.Inflows_model = new class_Inflows_model(tx)
    }

    public async run(IdWorkspace: number, IdUser: number, body: InflowsNamespace.CreateInflowPayload) {
        //  O Received fica de fora do spread: ele é uma instrução, não uma coluna.
        let { Received, ...columns } = body

        return await this.Inflows_model.create({
            ...columns,
            IdWorkspace,
            //  Autoria do lançamento; o dono do dado é o workspace.
            IdUser,
            //  Em 'inflow' o dinheiro veio de fora: a coluna existe, mas fica nula.
            IdFromAccount: body.Kind === "transfer" ? body.IdFromAccount : null,
            Status: Received ? "received" : "pending",
            //  O instante vem do relógio do banco, dentro desta transaction, como no
            //  Inflows_model.receive: uma linha recebida sem ReceivedAt seria um recibo sem
            //  data, e uma pendente com ele seria o contrário.
            ReceivedAt: Received ? this.tx.fn.now() as unknown as Database.Inflows["ReceivedAt"] : null,
        }).returnId("IdInflow")
    }
}
