import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ConfirmEmailContext } from "../controller";

/** Confirmar o e-mail com o token do link.
 *
 *  Roda na MONTAGEM da tela: quem clicou no link já disse o que queria,
 *  e um botão "confirmar" aqui seria um segundo clique para a mesma
 *  intenção.
 *
 *  A rota é idempotente — clicar duas vezes responde `200` das duas —, e
 *  é por isso que o sucesso desta section não depende de ser a primeira
 *  vez. O caso não é hipotético: o pré-carregador de link de vários
 *  clientes de e-mail abre a URL sozinho.
 *
 *  O `406` é um só, para token inválido, expirado (48h) e de outra
 *  finalidade. A saída é a mesma nos três: reenviar. */
export async function confirmEmail(context: ConfirmEmailContext): Promise<void> {
    if (!context.token) {
        context.failConfirm("Este link está incompleto. Peça outro e-mail de confirmação.");
        return;
    }

    context.beginConfirm();

    try {
        const { msg } = await UsersConnection.confirmEmail({ Token: context.token });
        context.finishConfirm(msg);
    } catch (cause) {
        context.failConfirm(errorMessage(cause));
    }
}
