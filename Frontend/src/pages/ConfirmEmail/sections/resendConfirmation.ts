import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ConfirmEmailContext } from "../controller";

/** Pedir o link de confirmação de novo.
 *
 *  A resposta é `200` sempre e com a mesma `msg` — inclusive para
 *  e-mail sem conta e para quem já confirmou —, pela mesma razão do
 *  `forgotPassword`: responder diferente faria da rota um verificador
 *  de quais endereços estão cadastrados. A tela mostra a `msg` como
 *  veio.
 *
 *  A API tem um freio de 2 minutos por endereço, e ele **não muda a
 *  resposta**: um `429` aqui devolveria exatamente o que a resposta
 *  única esconde, porque só um endereço com conta chegaria a ter
 *  cooldown para estourar. Quem segura o botão é a tela. */
export async function resendConfirmation(context: ConfirmEmailContext): Promise<void> {
    const email = context.email.trim();

    if (!email) {
        context.failResend("Informe o e-mail da sua conta.");
        return;
    }

    context.beginResend();

    try {
        const { msg } = await UsersConnection.resendConfirmation({ Email: email });
        context.finishResend(msg);
    } catch (cause) {
        context.failResend(errorMessage(cause));
    }
}
