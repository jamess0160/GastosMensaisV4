import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { WorkspaceContext } from "../controller";

/** Revogar um convite pendente.
 *
 *  O link para de funcionar NA HORA — é o conserto de ter mandado o
 *  convite para o endereço errado, e o link é compartilhável por
 *  desenho, então essa pressa é o ponto.
 *
 *  ⚠️ **Revogar não desfaz matrícula já criada.** Se a pessoa já
 *  aceitou, o convite nem aparece mais nesta lista (ela só traz os
 *  pendentes) e tirá-la do espaço é outra coisa — que ainda não existe
 *  no contrato (pendência 20). A tela não pode sugerir o contrário.
 *
 *  406 em convite de outro workspace, ou que não está mais `pending`. */
export async function revokeInvite(
    context: WorkspaceContext,
    idWorkspaceInvite: number,
): Promise<void> {
    context.beginSubmit("invite");

    try {
        await WorkspacesConnection.revokeInvite(idWorkspaceInvite);
        context.refreshInvites();
        context.finishSubmit("invite", "Convite revogado — o link parou de funcionar.");
    } catch (cause) {
        context.failSubmit("invite", errorMessage(cause));
    }
}
