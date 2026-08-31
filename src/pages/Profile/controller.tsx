import { changePassword } from "./sections/changePassword";
import { removePasskey } from "./sections/removePasskey";
import { saveProfile } from "./sections/saveProfile";
import { switchWorkspace } from "./sections/switchWorkspace";
import type { ApiTypes } from "@/types/api";

/** O que a tela entrega aos eventos. */
export interface ProfileContext {
    user: ApiTypes.User;
    /** Só os dígitos — a API tipa `Phone` como número. */
    form: { name: string; email: string; phone: string };
    passwordForm: { oldPassword: string; newPassword: string; confirmation: string };
    beginSubmit(scope: ProfileScope): void;
    failSubmit(scope: ProfileScope, message: string): void;
    finishSubmit(scope: ProfileScope, message: string): void;
    /** Relê o que mudou no servidor. */
    refresh(): void;
    /** O `switch` REEMITE o cookie: depois dele todo cache de query está
     *  falando do workspace antigo. */
    resetAllCaches(): void;
    clearPasswordForm(): void;
}

/** Cada bloco da tela tem seu próprio "enviando" e sua própria
 *  mensagem: trocar a senha não pode apagar o aviso de que os dados
 *  foram salvos. */
export type ProfileScope = "profile" | "password" | "passkey" | "workspace";

class Controller {
    readonly saveProfile = saveProfile;
    readonly changePassword = changePassword;
    readonly removePasskey = removePasskey;
    readonly switchWorkspace = switchWorkspace;
}

export const ProfileController = new Controller();
