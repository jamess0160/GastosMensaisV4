import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";
import type { WorkspaceContext } from "../controller";

/** O que a pessoa passa a poder fazer, por papel. Mesma frase do rótulo
 *  da linha: o aviso de sucesso tem de repetir o que o seletor diz, ou
 *  quem clicou fica sem saber se acertou o lado. */
const BECAME: Record<ApiTypes.WorkspaceRole, string> = {
    editor: "pode lançar e editar",
    viewer: "só consulta",
};

/** Trocar o papel de quem já é membro.
 *
 *  É o conserto de ter convidado no papel errado. Antes desta rota o
 *  papel era imutável depois do aceite, e a saída era remover e convidar
 *  de novo — o que apagava a matrícula e com ela a data de entrada.
 *
 *  **Só o dono**: quem não é leva 403, e a tela nem mostra o seletor. E
 *  ninguém troca o próprio papel — a própria matrícula responde 406, com
 *  a `msg` mandando transferir a propriedade. Por isso a linha marcada
 *  com `IsSelf` também não tem seletor: uma ação que sempre falha não é
 *  uma ação.
 *
 *  `owner` não é um valor possível aqui — `WorkspaceRole` não o tem, e a
 *  API o recusaria.
 *
 *  Relê a lista de membros em vez de mexer no cache à mão: o papel é o
 *  que decide o que a pessoa pode escrever, e um papel velho na tela é
 *  exatamente o que não pode acontecer nesta lista. */
export async function updateMemberRole(
    context: WorkspaceContext,
    member: ApiTypes.WorkspaceMember,
    role: ApiTypes.WorkspaceRole,
): Promise<void> {
    /* Clicar no papel que já está lá não gasta requisição: o seletor é
       um radiogroup, e o clique no botão aceso chega aqui igual. */
    if (member.Role === role) return;

    context.beginSubmit("members");

    try {
        await WorkspacesConnection.updateMember(member.IdWorkspaceMember, { Role: role });
        context.refreshMembers();
        context.finishSubmit("members", `${member.Name} agora ${BECAME[role]}.`);
    } catch (cause) {
        /* 403 quando quem chamou não é dono, 406 na própria matrícula ou
           numa que não é deste espaço. As três mensagens vêm prontas do
           servidor. */
        context.failSubmit("members", errorMessage(cause));
    }
}
