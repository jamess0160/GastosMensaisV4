import { changePassword } from "./sections/changePassword";
import { removePasskey } from "./sections/removePasskey";
import { saveProfile } from "./sections/saveProfile";
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
    clearPasswordForm(): void;
}

/** Cada bloco da tela tem seu próprio "enviando" e sua própria
 *  mensagem: trocar a senha não pode apagar o aviso de que os dados
 *  foram salvos.
 *
 *  `workspace` saiu: trocar de espaço virou gesto do CHASSI
 *  (`useSwitchWorkspace`, em `app/session.tsx`), porque ele reescreve o
 *  cookie e o sistema inteiro — não é um bloco de uma tela. */
export type ProfileScope = "profile" | "password" | "passkey";

class Controller {
    readonly saveProfile = saveProfile;
    readonly changePassword = changePassword;
    readonly removePasskey = removePasskey;
}

export const ProfileController = new Controller();
