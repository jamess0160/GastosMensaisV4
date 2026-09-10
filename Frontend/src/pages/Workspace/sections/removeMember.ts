import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";
import type { WorkspaceContext } from "../controller";

/** Tirar alguém do espaço.
 *
 *  É o que faltava para o convite ter volta: revogar só funciona ANTES
 *  do aceite, e depois dele o acesso era definitivo.
 *
 *  **A matrícula é apagada de verdade**, e não arquivada — por isso a
 *  confirmação da tela, no mesmo padrão do arquivamento de Contas: não
 *  há desfazer, readmitir é convidar de novo, e a data de entrada
 *  recomeça.
 *
 *  **Nada do que a pessoa lançou é tocado**, e é isso que a confirmação
 *  precisa dizer: gasto, entrada e conta são do ESPAÇO, e quem responde
 *  "quem gastou" é a lista de pessoas, que não tem relação com quem tem
 *  login. Nenhum saldo muda.
 *
 *  **Só o dono**: quem não é leva 403, e a tela nem mostra o botão. E
 *  ninguém se remove por aqui — a própria matrícula responde 406,
 *  mandando transferir a propriedade. Por isso a linha marcada com
 *  `IsSelf` também não tem botão: uma ação que sempre falha não é uma
 *  ação.
 *
 *  Relê a lista de membros em vez de tirar a linha do cache à mão: a
 *  lista é a própria tela em que a ação acontece, e quem sumiu de
 *  verdade é o servidor que diz. */
export async function removeMember(
    context: WorkspaceContext,
    member: ApiTypes.WorkspaceMember,
): Promise<void> {
    context.beginSubmit("members");

    try {
        await WorkspacesConnection.removeMember(member.IdWorkspaceMember);
        context.refreshMembers();
        context.finishSubmit(
            "members",
            `${member.Name} não tem mais acesso. O que ela lançou continua aqui.`,
        );
    } catch (cause) {
        /* 403 quando quem chamou não é dono, 406 na própria matrícula ou
           numa que não é deste espaço. As três mensagens vêm prontas do
           servidor. */
        context.failSubmit("members", errorMessage(cause));
    }
}
