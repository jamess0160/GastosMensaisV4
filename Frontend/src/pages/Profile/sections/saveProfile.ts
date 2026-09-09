import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ProfileContext } from "../controller";

/** Salvar nome, e-mail e telefone.
 *
 *  O PUT é substituição, não merge: os três campos são obrigatórios e
 *  vão sempre, mesmo os que não mudaram. Mandar só o que mudou responde
 *  406 por campo faltando.
 *
 *  **Trocar o e-mail DERRUBA a confirmação.** A API zera o
 *  `EmailConfirmedAt` e dispara um e-mail para o endereço NOVO — e o
 *  `refresh()` daqui invalida `sessionKeys.user`, então a faixa do
 *  chassi volta sozinha. O que falta é o recado: sem ele, o usuário vê
 *  "Dados atualizados", a faixa reaparece do nada e ele não liga uma
 *  coisa à outra. Mandar o mesmo e-mail de volta — quem só mudou o nome
 *  — não mexe em nada. */
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

    /* Comparado em minúsculas porque é assim que a API grava e devolve:
       "Tiago@X.com" e "tiago@x.com" são o mesmo endereço, e avisar de
       uma confirmação que não caiu seria mentira. */
    const emailChanged = email.trim().toLowerCase() !== context.user.Email.trim().toLowerCase();

    context.beginSubmit("profile");

    try {
        await UsersConnection.update(context.user.IdUser, {
            Name: name.trim(),
            Email: email.trim(),
            Phone: Number(phone),
        });
        context.refresh();
        context.finishSubmit(
            "profile",
            emailChanged
                ? "Dados atualizados. Confirme o novo e-mail: mandamos um link para ele."
                : "Dados atualizados.",
        );
    } catch (cause) {
        context.failSubmit("profile", errorMessage(cause));
    }
}
