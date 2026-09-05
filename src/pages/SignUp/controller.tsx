import { submitSignUp } from "./sections/submitSignUp";

/** O que a tela entrega aos eventos. */
export interface SignUpContext {
    name: string;
    email: string;
    /** Texto puro: o que a API recebe vira a credencial efetiva. */
    password: string;
    passwordConfirmation: string;
    /** Só os dígitos — a API tipa `Phone` como número. */
    phone: string;
    acceptedTerms: boolean;
    /** O hash do convite, quando a pessoa chegou por um link.
     *
     *  Substituiu o `IdWorkspace`, que matriculava como `owner` sem
     *  convite nem conferência. Com ele, o cadastro entra no espaço de
     *  quem convidou; sem ele, nasce um espaço novo. O E-MAIL PRECISA
     *  BATER com o do convite — é o que impede o link encaminhado de
     *  virar porta de entrada. */
    inviteHash: string | null;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Conta criada E sessão de pé: vai para a área logada. */
    finishSignUp(): void;
}

class Controller {
    readonly submitSignUp = submitSignUp;
}

export const SignUpController = new Controller();
