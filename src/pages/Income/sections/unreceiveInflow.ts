import { errorMessage } from "@/api/client";
import { InflowsConnection } from "@/api/Inflows.connection";
import type { IncomeContext } from "../controller";

/** Desfazer o recebimento — o caminho de volta do `receiveInflow`.
 *
 *  Um clique errado em "Recebido" credita a conta, e até a leva 3 não
 *  havia como voltar pela tela. Com o botão de status na linha, o par
 *  virou obrigatório: quem pode ligar precisa poder desligar.
 *
 *  A rota é a pendência 14 e AINDA NÃO EXISTE. O botão fica habilitado
 *  assim mesmo: enquanto ela não subir, o usuário vê a mensagem de erro
 *  da API, como em qualquer 406. Esconder o caminho ensinaria que ele
 *  não existe — e o dia em que a rota subir, nada na tela precisaria
 *  mudar. */
export async function unreceiveInflow(context: IncomeContext, idInflow: number): Promise<void> {
    context.beginSubmit();

    try {
        await InflowsConnection.unreceive(idInflow);
        context.finishSubmit("Recebimento desfeito — o dinheiro saiu do saldo da conta.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
