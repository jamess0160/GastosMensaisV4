import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ProfileContext } from "../controller";

/** Salvar nome, e-mail e telefone.
 *
 *  O PUT é substituição, não merge: os três campos são obrigatórios e
 *  vão sempre, mesmo os que não mudaram. Mandar só o que mudou responde
 *  406 por campo faltando. */
export async function saveProfile(context: ProfileContext): Promise<void> {
    const { name, email, phone } = context.form;

    if (!name.trim()) {
        context.failSubmit("profile", "Informe seu nome.");
        return;
    }
    if (!email.trim()) {
        context.failSubmit("profile", "Informe seu e-mail.");
        return;
    }
    if (phone.length < 10) {
        context.failSubmit("profile", "Informe um telefone com DDD.");
        return;
    }

    context.beginSubmit("profile");

    try {
        await UsersConnection.update(context.user.IdUser, {
            Name: name.trim(),
            Email: email.trim(),
            Phone: Number(phone),
        });
        context.refresh();
        context.finishSubmit("profile", "Dados atualizados.");
    } catch (cause) {
        context.failSubmit("profile", errorMessage(cause));
    }
}
