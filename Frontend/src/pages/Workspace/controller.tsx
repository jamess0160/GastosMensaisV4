import { createInvite } from "./sections/createInvite";
import { leaveWorkspace } from "./sections/leaveWorkspace";
import { removeMember } from "./sections/removeMember";
import { revokeInvite } from "./sections/revokeInvite";
import { saveWorkspace } from "./sections/saveWorkspace";
import { transferOwnership } from "./sections/transferOwnership";
import { updateMemberRole } from "./sections/updateMemberRole";
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
export type WorkspaceScope = "name" | "invite" | "members";

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
    /** Relê quem tem acesso. Chave própria, e não a dos convites: as
     *  duas listas mudam por motivos diferentes, e trocar o papel de um
     *  membro só mexe nesta. */
    refreshMembers(): void;
    /** O nome do espaço aparece na sidebar, em toda tela: depois de
     *  renomear, a lista de workspaces da sessão está velha.
     *
     *  E depois de SAIR ela está velha de outra forma: o espaço de onde
     *  se saiu continuaria na lista, e é dela que o chassi tira o espaço
     *  atual. Quando não sobra nenhum, é esta releitura que faz a tela
     *  chegar na criação de espaço.
     *
     *  Depois de TRANSFERIR A PROPRIEDADE ela está velha de uma terceira:
     *  quem diz à tela que você é o dono é o `IdOwnerUser` do espaço, que
     *  vem nesta lista — e ele acabou de apontar para outra pessoa. Sem
     *  esta releitura a tela seguiria oferecendo o bloco de convites a
     *  quem agora leva 403, e escondendo o botão de sair de quem agora
     *  pode usá-lo. */
    refreshWorkspaces(): void;
    clearInviteDraft(): void;
}

class Controller {
    readonly saveWorkspace = saveWorkspace;
    readonly createInvite = createInvite;
    readonly revokeInvite = revokeInvite;
    readonly updateMemberRole = updateMemberRole;
    readonly removeMember = removeMember;
    readonly transferOwnership = transferOwnership;
    readonly leaveWorkspace = leaveWorkspace;
}

export const WorkspaceController = new Controller();
