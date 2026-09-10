import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import { UsersAuthConnection } from "@/api/UsersAuth.connection";
import type { LoginContext } from "../controller";

/** O convite de biometria só aparece quando este aparelho nunca foi
 *  perguntado.
 *
 *  `checkDevice` é tri-estado: `true` já tem passkey aqui (e o botão de
 *  biometria já apareceu antes do login), `false` é recusa registrada, e
 *  `null` é "nunca perguntei". Aparelho sem `DeviceKey` nenhum também é
 *  "nunca perguntei" — não há o que consultar.
 *
 *  Falhar a consulta não pode segurar quem acabou de entrar, então o
 *  erro é engolido: na dúvida, não convida. */
async function shouldInviteBiometrics(deviceKey: string | null): Promise<boolean> {
    if (!deviceKey) return true;

    try {
        const { UseAuth } = await UsersAuthConnection.checkDevice(deviceKey);
        return UseAuth === null;
    } catch {
        return false;
    }
}

/** Login por e-mail e senha.
 *
 *  O 200 vale pelo `Set-Cookie`, não pelo corpo — quem confirma a sessão
 *  depois é o `getSelf` do guard. Credencial errada volta 401 com a mesma
 *  `msg` para e-mail inexistente e senha errada, de propósito: mostre-a
 *  como veio, sem tentar distinguir os dois casos.
 *
 *  É um 401 QUE NÃO É SESSÃO EXPIRADA, e quem faz essa distinção é o
 *  interceptor do client, pelo corpo da resposta — aqui só se pede a
 *  frase ao `errorMessage`, como em qualquer outro erro.
 *
 *  Com a sessão de pé, o convite de biometria vem ANTES de sair da tela:
 *  as rotas de registro de passkey são autenticadas, e é aqui que o
 *  cookie acabou de nascer.
 *
 *  `RememberDevice` decide a DURAÇÃO do cookie que acabou de nascer:
 *  30 dias marcado, 24h sem. Nada é guardado deste lado — quem mantém a
 *  sessão é o cookie `HttpOnly`, e a escolha viaja dentro do token. */
export async function submitLogin(context: LoginContext): Promise<void> {
    context.beginSubmit();

    try {
        await UsersConnection.login({
            login: context.email,
            password: context.password,
            RememberDevice: context.rememberDevice,
        });

        if (await shouldInviteBiometrics(context.deviceKey)) {
            context.setInviteBiometrics(true);
            return;
        }

        context.finishSignIn();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
