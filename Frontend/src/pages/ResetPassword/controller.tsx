import { submitNewPassword } from "./sections/submitNewPassword";

/** O que a tela pública de "criar senha nova" entrega aos eventos. */
export interface ResetPasswordContext {
    /** O `?Token=` do link do e-mail. Ele é a credencial inteira desta
     *  tela — não há sessão aqui. */
    token: string;
    password: string;
    confirmation: string;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Senha trocada. A troca NÃO abre sessão: não vem `Set-Cookie`
     *  nenhum, e o caminho a partir daqui é o login com a senha nova. */
    finishSubmit(message: string): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly submitNewPassword = submitNewPassword;
}

export const ResetPasswordController = new Controller();
