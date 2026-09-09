import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";
import type { InviteContext } from "../controller";

/** Aceitar o convite — de quem JÁ TEM conta.
 *
 *  São DUAS chamadas, e a segunda é a que se esquece.
 *
 *  `POST /Workspaces/join` cria a matrícula e **não troca a sessão**,
 *  de propósito: aceitar não pode trocar o workspace debaixo da tela que
 *  o usuário estava usando. Sem o `switch` logo em seguida, ele aceita o
 *  convite, é levado para dentro do app e continua vendo o espaço
 *  antigo — o bug mais provável desta entrega, e um que não dá erro
 *  nenhum, só confunde.
 *
 *  Aqui o `switch` é o certo justamente porque o gesto foi explícito: a
 *  pessoa clicou em "entrar neste espaço", não estava no meio de outra
 *  coisa. O `switch` reemite o cookie e descarta todo o cache, que é o
 *  que `useSwitchWorkspace` faz.
 *
 *  Os cinco `406` — inexistente, revogado, expirado, já usado e e-mail
 *  diferente — sobem com a `msg` do servidor, porque é ela que manda o
 *  usuário para o lugar certo: "expirou, peça outro" e "não encontrado"
 *  não levam ao mesmo lugar. */
export async function acceptInvite(
    context: InviteContext,
    switchWorkspace: (idWorkspace: number) => Promise<ApiTypes.Workspace>,
): Promise<void> {
    context.beginSubmit();

    try {
        const { IdWorkspace } = await WorkspacesConnection.join(context.hash);
        const workspace = await switchWorkspace(IdWorkspace);
        context.finishAccept(workspace);
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
