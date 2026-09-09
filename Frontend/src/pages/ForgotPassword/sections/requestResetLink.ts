import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ForgotPasswordContext } from "../controller";

/** Pedir o link de recuperação.
 *
 *  A validação daqui é só de FORMA — e-mail em branco não vale uma
 *  requisição. Se o endereço tem conta ou não, esta tela não fica
 *  sabendo em nenhuma hipótese: a resposta é `200` com a mesma `msg`
 *  nos dois casos, e é isso que impede a rota de virar um verificador
 *  de quais e-mails estão cadastrados. */
export async function requestResetLink(context: ForgotPasswordContext): Promise<void> {
    const email = context.email.trim();

    if (!email) {
        context.failSubmit("Informe o e-mail da sua conta.");
        return;
    }

    context.beginSubmit();

    try {
        const { msg } = await UsersConnection.forgotPassword({ Email: email });
        context.finishSubmit(msg);
    } catch (cause) {
        /* Um 406 aqui é forma do e-mail recusada pelo Joi, não "não
           existe" — a rota não tem esse caso. A `msg` do servidor já
           chega pronta. */
        context.failSubmit(errorMessage(cause));
    }
}
