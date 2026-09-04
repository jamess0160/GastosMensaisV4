import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { APIError } from "root/Utils/Logs"
import { InflowKind } from "../InflowKind.section"
import { InflowSplit } from "../InflowSplit.section"
import { InflowsNamespace } from "../types"
import { CreateOne } from "./createOne"

//  Grava N entradas de uma vez: tudo ou nada.
//
//  Cada item é **o mesmo corpo do POST /Inflows**, validado pelo mesmo schema — nada de shape
//  paralelo: o que é 406 sozinho é 406 no lote.
//
//  Esta rota substitui o "clonar o mês anterior" que a pendência 11 pedia. Quem escolhe o que
//  clonar é o usuário, item a item, e o cliente monta as cópias (avanço das datas, aparo do dia
//  no mês curto, rateio junto). Ao servidor sobrou gravar — e por isso **idempotência não é
//  problema daqui**: não há repetição silenciosa a evitar, só duplo clique, e quem desabilita o
//  botão enquanto grava é o cliente.
export class CreateBatch {
    public async run(SelectedIdWorkspace: number, IdUser: number, items: InflowsNamespace.CreateInflowPayload[]) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  Os N itens conferidos ANTES de abrir a transaction, como no avulso e pelo mesmo
        //  motivo: um corpo inválido é recusado sem nunca ter aberto uma.
        await this.assertItems(IdWorkspace, items)

        let IdInflows = await KnexTransaction(async (tx) => {
            let createOne = new CreateOne(tx)
            let ids: number[] = []

            for (let item of items) {
                ids.push(await createOne.run(IdWorkspace, IdUser, item))
            }

            return ids
        })

        return { msg: "Entradas cadastradas com sucesso", IdInflows }
    }

    //  A msg carrega qual item foi recusado. "O rateio não fecha com o total", sem dizer qual
    //  das cinco linhas, é um erro que o usuário não consegue consertar — ele teria que
    //  conferir todas à mão. O Index no data é a posição no array que ele mandou (base 0),
    //  para a tela conseguir destacar a linha.
    private async assertItems(IdWorkspace: number, items: InflowsNamespace.CreateInflowPayload[]) {
        for (let [Index, item] of items.entries()) {
            try {
                await InflowKind.assertAccounts(IdWorkspace, item)
                await InflowSplit.assertSplit(IdWorkspace, item.Kind, item.TotalValue, item.Persons)
            } catch (error) {
                if (error instanceof APIError) {
                    throw new APIError({
                        msg: `Item ${Index + 1}: ${error.msg}`,
                        status: error.status,
                        data: { ...error.data, Index },
                    })
                }

                throw error
            }
        }
    }
}
