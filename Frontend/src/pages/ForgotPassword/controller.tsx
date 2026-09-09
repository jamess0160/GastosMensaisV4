import { requestResetLink } from "./sections/requestResetLink";

/** O que a tela pública de "esqueci minha senha" entrega aos eventos. */
export interface ForgotPasswordContext {
    email: string;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Deu certo — e "certo" aqui não quer dizer que a conta existe.
     *
     *  A rota responde `200` com a MESMA `msg` para e-mail cadastrado e
     *  para e-mail que não existe, de propósito: responder diferente
     *  faria dela um verificador de quais endereços têm conta. A tela
     *  mostra a `msg` como veio e nunca escreve "e-mail não encontrado". */
    finishSubmit(message: string): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly requestResetLink = requestResetLink;
}

export const ForgotPasswordController = new Controller();
