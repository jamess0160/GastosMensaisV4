import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { SignUpContext } from "../controller";

/** O que a tela confere antes de gastar uma requisição.
 *
 *  Nenhuma destas regras substitui a validação do servidor — elas só
 *  evitam a viagem de ida e volta para dizer o que já se sabia aqui. A
 *  confirmação de senha, em especial, é a única que a API não tem como
 *  checar: para ela chega um campo só. */
export function validateSignUp(context: SignUpContext): string | null {
    if (!context.name.trim()) return "Informe seu nome.";
    if (!context.email.trim()) return "Informe seu e-mail.";
    if (context.phone.length < 10) return "Informe um telefone com DDD.";
    if (context.password.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
    if (context.password !== context.passwordConfirmation) return "As senhas não conferem.";
    if (!context.acceptedTerms) return "É preciso aceitar os termos para criar a conta.";
    return null;
}

/** Criar conta e entrar.
 *
 *  São DUAS requisições de propósito: `POST /Users` cria o usuário, o
 *  workspace, a matrícula e a Person numa transaction só, mas NÃO loga —
 *  não devolve cookie. Sem o `login` em seguida, a conta existiria e a
 *  tela seguinte responderia 401.
 *
 *  Duas coisas que o contrato exige e que é fácil errar aqui:
 *
 *  - a senha vai em TEXTO PURO. Pré-hashear no cliente não protege nada:
 *    o que a API recebe vira a credencial efetiva, e um hash vazado
 *    seria reproduzido como está. O bcrypt (custo 12) roda no servidor.
 *  - `IdWorkspace` NÃO é enviado. Ele é aceito pela API, mas entra
 *    direto como matrícula `owner`, sem convite nem conferência — é
 *    pendência de segurança conhecida do backend, e o cliente não a usa
 *    até virar convite assinado.
 *
 *  Se o cadastro passar e o login falhar, a conta ficou criada: a
 *  mensagem manda entrar em vez de sugerir cadastrar de novo, que
 *  responderia "e-mail já em uso". */
export async function submitSignUp(context: SignUpContext): Promise<void> {
    const invalid = validateSignUp(context);
    if (invalid) {
        context.failSubmit(invalid);
        return;
    }

    context.beginSubmit();

    try {
        await UsersConnection.signUp({
            Name: context.name.trim(),
            Email: context.email.trim(),
            Password: context.password,
            Phone: Number(context.phone),
        });
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
        return;
    }

    try {
        await UsersConnection.login({ login: context.email.trim(), password: context.password });
        context.finishSignUp();
    } catch {
        context.failSubmit("Conta criada, mas não foi possível entrar. Tente fazer login.");
    }
}
