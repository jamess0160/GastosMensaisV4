import { createInvite } from "./sections/createInvite";
import { revokeInvite } from "./sections/revokeInvite";
import { saveWorkspace } from "./sections/saveWorkspace";
import type { ApiTypes } from "@/types/api";

/** O rascunho do convite.
 *
 *  `Role` não aceita `owner`: propriedade não se convida, e mandá-lo
 *  responde 406. Por isso o seletor da tela tem dois valores, não três —
 *  o tipo já não deixa escrever o terceiro. */
export interface InviteDraft {
    Email: string;
    Role: ApiTypes.WorkspaceRole;
}

/** Cada bloco da tela tem seu próprio "enviando" e sua própria mensagem:
 *  renomear o espaço não pode apagar o aviso de que o convite foi
 *  criado. É a mesma separação do Perfil. */
export type WorkspaceScope = "name" | "invite";

export interface WorkspaceContext {
    /** O nome digitado no formulário — o PUT age no espaço da SESSÃO e
     *  não recebe id, então não há o que identificar aqui. */
    name: string;
    inviteDraft: InviteDraft;
    beginSubmit(scope: WorkspaceScope): void;
    failSubmit(scope: WorkspaceScope, message: string): void;
    finishSubmit(scope: WorkspaceScope, message: string): void;
    /** Relê a lista de convites pendentes. */
    refreshInvites(): void;
    /** O nome do espaço aparece na sidebar, em toda tela: depois de
     *  renomear, a lista de workspaces da sessão está velha. */
    refreshWorkspaces(): void;
    clearInviteDraft(): void;
}

class Controller {
    readonly saveWorkspace = saveWorkspace;
    readonly createInvite = createInvite;
    readonly revokeInvite = revokeInvite;
}

export const WorkspaceController = new Controller();
