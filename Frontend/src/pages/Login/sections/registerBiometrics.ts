import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { errorMessage } from "@/api/client";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { LoginContext } from "../controller";

/** Aceitar o convite de biometria, logo depois do login por senha.
 *
 *  Dois passos costurados pelo `ChallengeToken`, como o login por
 *  passkey — a diferença é que estas rotas são autenticadas, e é por
 *  isso que o convite só existe com a sessão já de pé.
 *
 *  O `DeviceKey` que volta é o que faz o `checkDevice` responder `true`
 *  na próxima visita: sem guardá-lo, a passkey existe no autenticador e
 *  a tela nunca a oferece. Registrar também limpa uma recusa anterior.
 *
 *  Falhar aqui não derruba ninguém: a sessão já está de pé e o usuário
 *  entra do mesmo jeito, só sem biometria. */
export async function registerBiometrics(context: LoginContext): Promise<void> {
    context.beginSubmit();

    try {
        const { options, ChallengeToken } = await UsersAuthConnection.registerOptions();

        const response = await startRegistration({
            optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
        });

        const { DeviceKey } = await UsersAuthConnection.register({
            ChallengeToken,
            Response: response,
            // Manda o que já existe no aparelho; sem ele a API gera um.
            ...(context.deviceKey ? { DeviceKey: context.deviceKey } : {}),
        });

        context.rememberDeviceKey(DeviceKey);
        context.finishSignIn();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
