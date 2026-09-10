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
 *  - `AcceptedTerms` é OBRIGATÓRIO e obrigatoriamente `true`. A
 *    conferência do checkbox aqui em cima não substitui nada: ela
 *    poupa a viagem, e quem recusa de verdade é o Joi, com 406. O
 *    campo diz QUE a pessoa aceitou; a versão do documento quem
 *    grava é a API, com a constante dela — o cliente não a manda,
 *    ou poderia afirmar ter concordado com um texto antigo.
 *  - `IdWorkspace` NÃO EXISTE MAIS: mandá-lo é 406. Ele entrava direto
 *    como matrícula `owner`, sem convite nem conferência, com um id
 *    sequencial que se adivinhava contando. No lugar dele vai o
 *    `InviteHash`, e só quando a pessoa chegou por um link — sem ele, o
 *    cadastro cria um espaço novo, que é o caso comum. O e-mail do
 *    cadastro precisa bater com o do convite, senão é 406.
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
            // Sempre `true`: o `validateSignUp` acima já devolveu quando
            // a caixa estava desmarcada, então daqui não sai `false`.
            AcceptedTerms: true,
            // Espalhado, e não `InviteHash: null`: quem não veio de um
            // convite não manda a chave.
            ...(context.inviteHash ? { InviteHash: context.inviteHash } : {}),
        });
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
        return;
    }

    /* A SEGUNDA requisição, e ela é obrigatória: o cadastro não devolve
       cookie. Sem ela, `finishSignUp` navegaria para dentro do app, o
       `getSelf` responderia 401 e o usuário recém-cadastrado cairia no
       login sem entender por quê.

       O `try` é separado do de cima de propósito: aqui a conta JÁ EXISTE,
       e o erro tem outro conserto. Um `catch` só diria "não foi possível
       criar a conta", e a pessoa tentaria de novo levando "e-mail já em
       uso" — presa entre duas telas que a mandam uma para a outra.

       O login já seleciona o primeiro workspace, então a sessão nunca
       começa sem espaço: quem se cadastrou por convite tem só o do
       convite, e quem se cadastrou sozinho tem só o que nasceu com a
       conta. Não há `switch` a fazer aqui. */
    try {
        await UsersConnection.login({ login: context.email.trim(), password: context.password });
        context.finishSignUp();
    } catch {
        context.failSubmit("Conta criada, mas não foi possível entrar. Tente fazer login.");
    }
}
