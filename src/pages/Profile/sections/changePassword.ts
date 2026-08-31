import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ProfileContext } from "../controller";

/** Trocar a senha.
 *
 *  As duas senhas vão no BODY, nunca na URL: o path cai no log de acesso
 *  do proxy, no histórico do navegador e no header `Referer` — três
 *  lugares onde uma senha em texto puro não se recupera depois de
 *  vazada. A connection já cuida disso; o que importa aqui é não montar
 *  a chamada de outro jeito.
 *
 *  E nada de pré-hashear: como no cadastro, o que a API recebe vira a
 *  credencial efetiva. O bcrypt roda no servidor.
 *
 *  Senha antiga errada volta 406 com `msg` pronta — mostre-a como veio. */
export async function changePassword(context: ProfileContext): Promise<void> {
    const { oldPassword, newPassword, confirmation } = context.passwordForm;

    if (!oldPassword) {
        context.failSubmit("password", "Informe a senha atual.");
        return;
    }
    if (newPassword.length < 8) {
        context.failSubmit("password", "A nova senha precisa de pelo menos 8 caracteres.");
        return;
    }
    if (newPassword !== confirmation) {
        context.failSubmit("password", "As senhas novas não conferem.");
        return;
    }
    if (newPassword === oldPassword) {
        context.failSubmit("password", "A nova senha é igual à atual.");
        return;
    }

    context.beginSubmit("password");

    try {
        await UsersConnection.updatePassword({ oldPassword, newPassword });
        context.clearPasswordForm();
        context.finishSubmit("password", "Senha alterada.");
    } catch (cause) {
        context.failSubmit("password", errorMessage(cause));
    }
}
