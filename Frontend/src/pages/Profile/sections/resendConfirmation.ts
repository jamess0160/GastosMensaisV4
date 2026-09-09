import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ProfileContext } from "../controller";

/** Reenviar o link de confirmação para o e-mail da conta.
 *
 *  O endereço vem do `user` da sessão, e não de um campo: aqui já se
 *  sabe de quem é a conta, e pedir o e-mail de novo abriria a porta de
 *  mandar confirmação para o endereço de outra pessoa.
 *
 *  A rota responde `200` sempre e com a mesma `msg` — inclusive para
 *  quem já confirmou. Mostre-a como veio; o freio de 2 minutos da API é
 *  por endereço e não muda a resposta, então quem segura o botão é a
 *  tela. */
export async function resendConfirmation(context: ProfileContext): Promise<void> {
    context.beginSubmit("confirmation");

    try {
        const { msg } = await UsersConnection.resendConfirmation({ Email: context.user.Email });
        context.finishSubmit("confirmation", msg);
    } catch (cause) {
        context.failSubmit("confirmation", errorMessage(cause));
    }
}
