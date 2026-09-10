import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";
import type { WorkspaceContext } from "../controller";

/** Passar a propriedade do espaço a outro membro.
 *
 *  É a ação que fechava o buraco de todas as outras: `owner` era papel
 *  de uma pessoa só e não se movia, então quem criou o espaço era dono
 *  para sempre — e o dono é justamente o único membro que não pode sair
 *  do próprio espaço. As três recusas anteriores (trocar o próprio
 *  papel, se remover, sair) mandavam transferir a propriedade, e não
 *  havia por onde.
 *
 *  **É a única ação do app que muda o que o PRÓPRIO usuário pode
 *  fazer**, e é daí que sai tudo o que esta section faz de diferente das
 *  outras da tela.
 *
 *  **RELÊ AS DUAS LISTAS, e a segunda é a que se esquece.** Os membros,
 *  porque os dois papéis trocaram. E os ESPAÇOS, porque quem diz à tela
 *  quem é o dono é o `IdOwnerUser` que vem no `getSelf` — sem essa
 *  releitura a tela continuaria oferecendo o bloco de convites a quem
 *  agora leva 403, e continuaria escondendo o botão de sair de quem
 *  agora pode usá-lo. As duas guardas já existem e leem o `isOwner` da
 *  sessão: é só a sessão que estaria velha.
 *
 *  Não há `switch` nem cache a zerar, ao contrário do `leaveWorkspace`:
 *  o espaço é o MESMO antes e depois, e as contas, os lançamentos e os
 *  saldos dele não mudaram em nada. O que mudou é quem manda nele.
 *
 *  **Desfazer depende do novo dono** — só ele pode devolver —, e é isso
 *  que a confirmação da tela precisa dizer, com o nome de quem recebe
 *  escrito por extenso. */
export async function transferOwnership(
    context: WorkspaceContext,
    member: ApiTypes.WorkspaceMember,
): Promise<void> {
    context.beginSubmit("members");

    try {
        await WorkspacesConnection.transferOwnership(member.IdWorkspaceMember);

        context.refreshMembers();
        /* O `isOwner` da sessão sai do `IdOwnerUser` do espaço, não do
           papel da matrícula: é esta releitura que faz a tela trocar de
           lado junto com a API. */
        context.refreshWorkspaces();

        context.finishSubmit(
            "members",
            `${member.Name} agora é o dono do espaço. Você continua podendo lançar e editar, e só ${member.Name} pode devolver a propriedade.`,
        );
    } catch (cause) {
        /* 403 quando quem chamou não é dono, 406 na própria matrícula ou
           numa que não é deste espaço. As três mensagens vêm prontas do
           servidor. */
        context.failSubmit("members", errorMessage(cause));
    }
}
