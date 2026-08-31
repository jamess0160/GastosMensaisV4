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
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Conta criada E sessão de pé: vai para a área logada. */
    finishSignUp(): void;
}

class Controller {
    readonly submitSignUp = submitSignUp;
}

export const SignUpController = new Controller();
