import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Inflows_model } from "../../Inflows.model"

//  'pending' <-> 'received'. É esta rota que move o saldo da conta — não porque escreva saldo
//  em lugar nenhum (não existe coluna), mas porque o cálculo só soma o que está recebido.
//
//  Tudo ou nada: não há 'partial' nem coluna ReceivedValue. Uma entrada que caiu pela metade é
//  duas entradas.
//
//  **Uma section com booleano, duas rotas**, exatamente como o ExpensePayments/POST/pay.ts
//  serve o pay e o unpay: a checagem de estado é a mesma nos dois sentidos, e duplicá-la em
//  duas sections é o jeito de elas divergirem depois.
//
//  **Não há transaction aqui, e é de propósito.** Desfazer não precisa "estornar" nada: o saldo
//  nunca é gravado — o AccountBalance o soma dos lançamentos a cada leitura, contando só o que
//  está 'received'. Voltar o Status para 'pending' **é** a retirada. (O pay precisa de
//  transaction porque recalcula o Status derivado do gasto na mesma janela; entrada não tem
//  derivado nenhum.)
export class Receive {
    public async run(SelectedIdWorkspace: number, IdInflow: number, IdUser: number, Received: boolean) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let inflow = await Inflows_model.getUnique(IdWorkspace, IdInflow)

        if (!inflow) {
            throw new APIError({
                msg: "Entrada não encontrada!",
                status: 406,
                data: { IdWorkspace, IdInflow },
            })
        }

        //  Cancelada não se move em nenhum dos dois sentidos: ela saiu do fluxo.
        if (inflow.Status === "canceled") {
            throw new APIError({
                msg: Received
                    ? "Entrada cancelada não pode ser recebida."
                    : "Entrada cancelada não tem recebimento a desfazer.",
                status: 406,
                data: { IdInflow, Status: inflow.Status },
            })
        }

        //  Receber de novo reescreveria o ReceivedAt de um dinheiro que já caiu — a data em que
        //  ele entrou é informação, não detalhe. E desfazer o que não foi recebido não é nada.
        if ((inflow.Status === "received") === Received) {
            throw new APIError({
                msg: Received
                    ? "Esta entrada já foi recebida."
                    : "Esta entrada não está recebida.",
                status: 406,
                data: { IdInflow, Status: inflow.Status },
            })
        }

        if (Received) {
            await Inflows_model.receive(IdInflow)
        } else {
            await Inflows_model.unreceive(IdInflow)
        }

        return { msg: Received ? "Entrada recebida com sucesso" : "Recebimento desfeito com sucesso" }
    }
}
