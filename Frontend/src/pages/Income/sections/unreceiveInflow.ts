import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext } from "../controller";

/** Desfazer o recebimento — o caminho de volta do `receiveInflow`.
 *
 *  Um clique errado em "Recebido" credita a conta, e até a leva 3 não
 *  havia como voltar pela tela. Com o botão de status na linha, o par
 *  virou obrigatório: quem pode ligar precisa poder desligar.
 *
 *  Sem body, como o `receive`. Volta o `Status` para `pending`, limpa o
 *  `ReceivedAt` e tira do saldo o que o recebimento creditou, tudo na
 *  mesma transaction. 406 quando a entrada já está pendente, quando
 *  está cancelada, ou quando o id não existe no workspace. */
export async function unreceiveInflow(context: IncomeContext, idInflow: number): Promise<void> {
    context.beginSubmit();

    try {
        await InflowsConnection.unreceive(idInflow);
        context.finishSubmit("Recebimento desfeito — o dinheiro saiu do saldo da conta.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
