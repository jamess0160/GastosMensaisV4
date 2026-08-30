import { loadBiometricsAvailability } from "./sections/loadBiometricsAvailability";
import { signInWithBiometrics } from "./sections/signInWithBiometrics";
import { submitLogin } from "./sections/submitLogin";

/** O que a tela entrega aos eventos. As sections não conhecem React:
 *  recebem daqui o estado atual e os verbos que mexem nele, e por isso
 *  podem ser lidas (e testadas) sem montar o componente. */
export interface LoginContext {
    /** Id do aparelho guardado localmente. `null` = biometria não se
     *  aplica aqui. */
    deviceKey: string | null;
    email: string;
    password: string;
    /** Entra em "enviando" e limpa o erro anterior. */
    beginSubmit(): void;
    /** Sai de "enviando" mostrando a mensagem. */
    failSubmit(message: string): void;
    /** Sessão de pé: limpa o cache e vai para a área logada. */
    finishSignIn(): void;
    setOfferBiometrics(offer: boolean): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly loadBiometricsAvailability = loadBiometricsAvailability;
    readonly signInWithBiometrics = signInWithBiometrics;
    readonly submitLogin = submitLogin;
}

export const LoginController = new Controller();
