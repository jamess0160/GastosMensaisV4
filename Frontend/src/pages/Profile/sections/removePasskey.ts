import { errorMessage } from "@/api/client";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { ProfileContext } from "../controller";

/** Remover uma passkey da conta.
 *
 *  É soft delete: a linha fica, para o `CredentialId` seguir ocupando o
 *  índice único — senão o mesmo autenticador registraria a passkey de
 *  novo como se fosse nova, e a remoção não teria significado.
 *
 *  O `DeviceKey` guardado localmente NÃO é apagado de propósito: ele
 *  também é o que registra "já perguntei sobre biometria neste
 *  aparelho". Apagá-lo aqui faria o convite voltar no próximo login, que
 *  é o oposto do que quem acabou de remover a passkey pediu. */
export async function removePasskey(context: ProfileContext, idUserAuth: number): Promise<void> {
    context.beginSubmit("passkey");

    try {
        await UsersAuthConnection.remove(idUserAuth);
        context.refresh();
        context.finishSubmit("passkey", "Biometria removida.");
    } catch (cause) {
        context.failSubmit("passkey", errorMessage(cause));
    }
}
