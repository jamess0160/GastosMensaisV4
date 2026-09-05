import { acceptInvite } from "./sections/acceptInvite";
import type { ApiTypes } from "@/types/api";

/** O que a tela pública de aceite entrega aos eventos. */
export interface InviteContext {
    /** O que veio na URL. É o único identificador do convite: o
     *  `IdWorkspace` nunca viaja no link, porque é sequencial. */
    hash: string;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Aceitou E já está operando no espaço novo — o `switch` depois do
     *  `join` já aconteceu. */
    finishAccept(workspace: ApiTypes.Workspace): void;
}

class Controller {
    readonly acceptInvite = acceptInvite;
}

export const InviteController = new Controller();
