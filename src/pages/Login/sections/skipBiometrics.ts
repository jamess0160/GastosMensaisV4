import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { LoginContext } from "../controller";

/** Recusar o convite de biometria neste aparelho.
 *
 *  `skipDevice` é o que faz o `checkDevice` passar a responder `false` —
 *  sem ele o convite voltaria a cada login, que é exatamente o tipo de
 *  insistência que faz o usuário desconfiar do aviso.
 *
 *  Recusar não pode falhar do ponto de vista de quem clicou: se a rota
 *  cair, a sessão continua de pé e a tela segue em frente. O preço é o
 *  convite voltar da próxima vez, que é melhor do que travar a entrada
 *  por causa de um "não, obrigado". */
export async function skipBiometrics(context: LoginContext): Promise<void> {
    try {
        const { DeviceKey } = await UsersAuthConnection.skipDevice(
            context.deviceKey ? { DeviceKey: context.deviceKey } : {},
        );
        context.rememberDeviceKey(DeviceKey);
    } catch {
        // Segue mesmo assim: a recusa não é o que o usuário veio fazer.
    }

    context.finishSignIn();
}
