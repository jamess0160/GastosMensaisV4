import { loadBiometricsAvailability } from "./sections/loadBiometricsAvailability";
import { registerBiometrics } from "./sections/registerBiometrics";
import { signInWithBiometrics } from "./sections/signInWithBiometrics";
import { skipBiometrics } from "./sections/skipBiometrics";
import { submitLogin } from "./sections/submitLogin";

/** O que a tela entrega aos eventos. As sections não conhecem React:
 *  recebem daqui o estado atual e os verbos que mexem nele, e por isso
 *  podem ser lidas (e testadas) sem montar o componente. */
export interface LoginContext {
    /** Id do aparelho guardado localmente. `null` = este aparelho nunca
     *  foi apresentado à API. */
    deviceKey: string | null;
    email: string;
    password: string;
    /** Entra em "enviando" e limpa o erro anterior. */
    beginSubmit(): void;
    /** Sai de "enviando" mostrando a mensagem. */
    failSubmit(message: string): void;
    /** Sessão de pé: limpa o cache e vai para a área logada. */
    finishSignIn(): void;
    /** Oferece o botão de entrar por biometria (antes do login). */
    setOfferBiometrics(offer: boolean): void;
    /** Abre o convite para cadastrar passkey (depois do login por senha).
     *  A sessão já está de pé quando isto acontece. */
    setInviteBiometrics(invite: boolean): void;
    /** Guarda no aparelho o `DeviceKey` que a API devolveu. */
    rememberDeviceKey(deviceKey: string): void;
}

/** Só DECLARA os eventos da tela — o corpo de cada um vive em
 *  ./sections, um arquivo por evento. */
class Controller {
    readonly loadBiometricsAvailability = loadBiometricsAvailability;
    readonly signInWithBiometrics = signInWithBiometrics;
    readonly submitLogin = submitLogin;
    readonly registerBiometrics = registerBiometrics;
    readonly skipBiometrics = skipBiometrics;
}

export const LoginController = new Controller();
