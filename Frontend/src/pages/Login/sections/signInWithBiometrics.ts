import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { errorMessage } from "@/api/client";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { LoginContext } from "../controller";

/** Login por passkey — dois passos costurados pelo `ChallengeToken`.
 *
 *  O desafio não fixa usuário: duas pessoas podem ter passkey no mesmo
 *  aparelho e quem escolhe é o autenticador. Quem resolve o usuário é a
 *  credencial assinada, não o `DeviceKey`. */
export async function signInWithBiometrics(context: LoginContext): Promise<void> {
    if (!context.deviceKey) return;

    context.beginSubmit();

    try {
        const { options, ChallengeToken } = await UsersAuthConnection.loginOptions(
            context.deviceKey,
        );

        // `options` vem no formato da spec e não é validado por Joi de
        // propósito: passe direto para a lib.
        const response = await startAuthentication({
            optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
        });

        /* O MESMO `RememberDevice` do login por senha: uma caixa só na
           tela, e os dois caminhos mandam o valor dela. Uma biometria
           que durasse 24h com a caixa marcada seria a promessa dos 30
           dias quebrada justamente por quem entra mais rápido. */
        await UsersAuthConnection.authenticate({
            ChallengeToken,
            Response: response,
            RememberDevice: context.rememberDevice,
        });
        context.finishSignIn();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
