import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ResetPasswordContext } from "../controller";

/** Gravar a senha nova com o token do link.
 *
 *  As regras de forma são as mesmas do "trocar a senha" do Perfil — oito
 *  caracteres e as duas iguais —, e ficam aqui pelo mesmo motivo de lá:
 *  uma senha que o servidor recusaria não vale uma ida à rede.
 *
 *  Token inválido, expirado ou já usado é sempre o MESMO `406`, com a
 *  `msg` pronta. E é a resposta certa: a ação da tela é a mesma nos três
 *  casos — mostrar a mensagem e oferecer pedir outro link. Distinguir só
 *  ajudaria quem está testando tokens.
 *
 *  Nada de pré-hashear a senha: o bcrypt roda no servidor, como no
 *  cadastro e no `updatePassword`. */
export async function submitNewPassword(context: ResetPasswordContext): Promise<void> {
    const { token, password, confirmation } = context;

    if (!token) {
        context.failSubmit("Este link está incompleto. Peça outro link de recuperação.");
        return;
    }
    if (password.length < 8) {
        context.failSubmit("A nova senha precisa de pelo menos 8 caracteres.");
        return;
    }
    if (password !== confirmation) {
        context.failSubmit("As senhas não conferem.");
        return;
    }

    context.beginSubmit();

    try {
        const { msg } = await UsersConnection.resetPassword({
            Token: token,
            NewPassword: password,
        });
        context.finishSubmit(msg);
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
