import { changePassword } from "./sections/changePassword";
import { deleteAccount } from "./sections/deleteAccount";
import { removePasskey } from "./sections/removePasskey";
import { resendConfirmation } from "./sections/resendConfirmation";
import { saveProfile } from "./sections/saveProfile";
import type { ApiTypes } from "@/types/api";

/** O que a tela entrega aos eventos. */
export interface ProfileContext {
    user: ApiTypes.User;
    /** Só os dígitos — a API tipa `Phone` como número. */
    form: { name: string; email: string; phone: string };
    passwordForm: { oldPassword: string; newPassword: string; confirmation: string };
    /** A senha que confirma o encerramento. Fica em campo próprio, e não
     *  no `passwordForm`: são dois formulários com dois botões, e um
     *  deles não se desfaz. */
    deleteForm: { password: string };
    beginSubmit(scope: ProfileScope): void;
    failSubmit(scope: ProfileScope, message: string): void;
    finishSubmit(scope: ProfileScope, message: string): void;
    /** Relê o que mudou no servidor. */
    refresh(): void;
    clearPasswordForm(): void;
    /** A conta não existe mais: zera o cache — ele fala de dados que
     *  acabaram de deixar de existir — e vai para o login.
     *
     *  Não chama `POST /Users/logout`: o `DELETE /Users` já respondeu
     *  com o cookie apagado, e um logout depois disso pediria a sessão
     *  de um usuário que não existe. */
    leaveForGood(): void;
}

/** Cada bloco da tela tem seu próprio "enviando" e sua própria
 *  mensagem: trocar a senha não pode apagar o aviso de que os dados
 *  foram salvos.
 *
 *  `workspace` saiu: trocar de espaço virou gesto do CHASSI
 *  (`useSwitchWorkspace`, em `app/session.tsx`), porque ele reescreve o
 *  cookie e o sistema inteiro — não é um bloco de uma tela.
 *
 *  `confirmation` é o bloco do estado do e-mail: a FAIXA do chassi é o
 *  lembrete, e o Perfil é onde se vai resolver de propósito.
 *
 *  `account` é o encerramento da conta, e ele fica no fim da tela e
 *  separado do resto de propósito: é a única ação daqui que não se
 *  desfaz. */
export type ProfileScope = "profile" | "password" | "passkey" | "confirmation" | "account";

class Controller {
    readonly saveProfile = saveProfile;
    readonly changePassword = changePassword;
    readonly removePasskey = removePasskey;
    readonly resendConfirmation = resendConfirmation;
    readonly deleteAccount = deleteAccount;
}

export const ProfileController = new Controller();
