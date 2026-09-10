import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { ProfileContext } from "../controller";

/** Apagar a conta.
 *
 *  A ação que não se desfaz do app inteiro: a linha de `Users` é apagada
 *  de verdade — não desativada —, os espaços em que a pessoa era a única
 *  integrante somem em cascata com contas, gastos, entradas e
 *  orçamentos, e as matrículas em espaços de terceiros somem sem tocar
 *  no que ela lançou lá dentro. É o art. 18 da LGPD, e é a razão de
 *  todos os freios abaixo.
 *
 *  **A SENHA VAI JUNTO, e não é formalidade.** A sessão dura até 30
 *  dias, então estar logado não prova que quem clicou é o dono da conta
 *  — aparelho emprestado e aba esquecida são o cenário exato desta tela.
 *  Ela vai no BODY, como no `changePassword`: o path cai no log de
 *  acesso do proxy, no histórico do navegador e no `Referer`.
 *
 *  **AS DUAS RECUSAS VÊM PRONTAS DO SERVIDOR, e nenhuma delas é falha
 *  de rede.** O 401 de senha errada é o 401 COM corpo — ele carrega a
 *  frase da API e não derruba a sessão, o que está certo: quem errou a
 *  senha continua com a conta de pé e não tem por que ser deslogado. O
 *  406 é o dono de um espaço compartilhado, e a `msg` dele nomeia o
 *  próximo passo (transferir a propriedade, em `/espaco`) — mostre-a
 *  como veio, porque uma frase inventada aqui esconderia a saída.
 *
 *  **No sucesso não há `finishSubmit`.** A conta não existe mais: não há
 *  a quem mostrar "pronto" nesta tela, e o cookie já voltou apagado da
 *  API. O que resta é zerar o cache — ele fala de dados que acabaram de
 *  deixar de existir — e ir para o login, e é isso que o `leaveForGood`
 *  do chassi da página faz. */
export async function deleteAccount(context: ProfileContext): Promise<void> {
    const password = context.deleteForm.password;

    if (!password) {
        context.failSubmit("account", "Digite a sua senha para confirmar.");
        return;
    }

    context.beginSubmit("account");

    try {
        await UsersConnection.remove({ Password: password });
    } catch (cause) {
        context.failSubmit("account", errorMessage(cause));
        return;
    }

    context.leaveForGood();
}
