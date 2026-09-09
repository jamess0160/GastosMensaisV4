import { confirmEmail } from "./sections/confirmEmail";
import { resendConfirmation } from "./sections/resendConfirmation";

/** O que a tela pública de confirmação entrega aos eventos. */
export interface ConfirmEmailContext {
    /** O `?Token=` do link do e-mail. É a credencial inteira desta tela
     *  — ela é pública porque quem não confirmou pode não ter sessão
     *  nenhuma: o link chega no cadastro e é aberto em outro aparelho. */
    token: string;
    /** O endereço para reenviar, quando o link não vale mais. */
    email: string;
    beginConfirm(): void;
    /** Confirmado.
     *
     *  Chamar a rota duas vezes responde `200` das duas, então este
     *  estado NÃO pode depender de ser a primeira vez: quem reabre o
     *  link — ou o pré-carregador do cliente de e-mail — tem que ver
     *  sucesso, não erro. */
    finishConfirm(message: string): void;
    failConfirm(message: string): void;

    beginResend(): void;
    finishResend(message: string): void;
    failResend(message: string): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly confirmEmail = confirmEmail;
    readonly resendConfirmation = resendConfirmation;
}

export const ConfirmEmailController = new Controller();
