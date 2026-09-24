import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import { isMobileDevice } from "@/lib/device";
import type { LoginContext } from "../controller";

/** Decide se a tela oferece biometria, na montagem.
 *
 *  **Só em aparelho móvel**, e a consulta nem sai fora dele: o WebAuthn
 *  expõe autenticador de plataforma no Windows Hello e no Touch ID igual
 *  ao do celular, então quem punha o botão na frente de quem usa mouse
 *  era o sistema operacional, não uma decisão de produto. Um passkey já
 *  registrado num desktop continua válido — ele só deixa de ser oferecido
 *  ali, e o Perfil continua listando e revogando de qualquer aparelho.
 *
 *  `checkDevice` é tri-estado: só `true` oferece. `false` é recusa já
 *  registrada neste aparelho e `null` é "nunca foi perguntado" — nos dois
 *  o usuário vai direto para a senha.
 *
 *  Falhar aqui não pode travar o login por senha, então o erro é
 *  engolido: sem resposta, não se oferece biometria. */
export async function loadBiometricsAvailability(context: LoginContext): Promise<void> {
    if (!isMobileDevice()) return;
    if (!context.deviceKey) return;

    try {
        const { UseAuth } = await UsersAuthConnection.checkDevice(context.deviceKey);
        context.setOfferBiometrics(UseAuth === true);
    } catch {
        context.setOfferBiometrics(false);
    }
}
