import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";
import type { WorkspaceContext } from "../controller";

/** Sair do espaço.
 *
 *  É a saída que faltava: quem foi convidado ficava no espaço para
 *  sempre, e a única forma de sumir de um espaço alheio era pedir ao
 *  dono para remover.
 *
 *  **É a guarda OPOSTA do `removeMember`.** Aquela rota exige ser dono;
 *  esta exige NÃO ser: enquanto ele for dono, sair deixaria o espaço sem
 *  quem convida e sem quem remove. Por isso o botão não aparece para o
 *  dono, e a chamada direta responde 406 mandando transferir a
 *  propriedade.
 *
 *  **SÃO DUAS CHAMADAS, e a segunda é a que se esquece** — a mesma
 *  armadilha do aceite de convite e da criação de espaço. `DELETE
 *  /Workspaces/members/self` não reemite o cookie, porque
 *  `POST /Workspaces/switch` é a única rota que recebe um `IdWorkspace`
 *  e uma saída não abre exceção nessa regra. Sem o `getSelf` + `switch`
 *  em seguida, o token continuaria apontando para o espaço de onde a
 *  pessoa acabou de sair e a tela inteira responderia 406 — sem nada
 *  dizendo por quê.
 *
 *  Se não sobrar espaço nenhum, não há para onde trocar: a sessão
 *  continua válida (ninguém é deslogado) e sem espaço a que voltar.
 *  Quem responde por essa tela é o `refreshWorkspaces`, que faz a lista
 *  voltar vazia do servidor — e a tela do espaço passa a oferecer a
 *  criação, que é a rota que não confere matrícula nenhuma.
 *
 *  A ORDEM IMPORTA. Depois do `DELETE` bem-sucedido a saída JÁ
 *  aconteceu, e um erro nas chamadas seguintes não pode ser lido como
 *  "não saiu": o que falhou aí é só descobrir para onde ir, e o
 *  conserto é o cache velho sair da frente. */
export async function leaveWorkspace(
    context: WorkspaceContext,
    switchWorkspace: (idWorkspace: number) => Promise<ApiTypes.Workspace>,
): Promise<void> {
    context.beginSubmit("members");

    try {
        await WorkspacesConnection.leave();
    } catch (cause) {
        /* 406 no dono, com a msg mandando transferir a propriedade — a
           única recusa que esta rota tem, e ela vem pronta do servidor. */
        context.failSubmit("members", errorMessage(cause));
        return;
    }

    try {
        /* Do servidor, e não do cache da sessão: é ele que sabe quais
           matrículas sobraram depois do DELETE. */
        const remaining = await WorkspacesConnection.getSelf();
        const next = remaining[0];

        if (!next) {
            context.refreshWorkspaces();
            context.finishSubmit("members", "Você saiu do espaço.");
            return;
        }

        /* O `switch` reemite o cookie e zera o cache: contas, categorias
           e lançamentos do espaço anterior não valem mais nada. É ele
           que faz cair no outro espaço sem passar por login. */
        const entered = await switchWorkspace(next.IdWorkspace);

        context.finishSubmit("members", `Você saiu do espaço. Agora você está em ${entered.Name}.`);
    } catch (cause) {
        context.refreshWorkspaces();
        context.failSubmit(
            "members",
            `Você saiu do espaço, mas não consegui entrar em outro: ${errorMessage(cause)}`,
        );
    }
}
