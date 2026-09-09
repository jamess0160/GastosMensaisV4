import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { LoginContext } from "../controller";

/** Decide se a tela oferece biometria, na montagem.
 *
 *  `checkDevice` é tri-estado: só `true` oferece. `false` é recusa já
 *  registrada neste aparelho e `null` é "nunca foi perguntado" — nos dois
 *  o usuário vai direto para a senha.
 *
 *  Falhar aqui não pode travar o login por senha, então o erro é
 *  engolido: sem resposta, não se oferece biometria. */
export async function loadBiometricsAvailability(context: LoginContext): Promise<void> {
    if (!context.deviceKey) return;

    try {
        const { UseAuth } = await UsersAuthConnection.checkDevice(context.deviceKey);
        context.setOfferBiometrics(UseAuth === true);
    } catch {
        context.setOfferBiometrics(false);
    }
}
