import { errorMessage } from "@/api/client";
import { UsersConnection } from "@/api/Users.connection";
import type { LoginContext } from "../controller";

/** Login por e-mail e senha.
 *
 *  O 200 vale pelo `Set-Cookie`, não pelo corpo — quem confirma a sessão
 *  depois é o `getSelf` do guard. Credencial errada volta 406 com a mesma
 *  `msg` para e-mail inexistente e senha errada, de propósito: mostre-a
 *  como veio, sem tentar distinguir os dois casos. */
export async function submitLogin(context: LoginContext): Promise<void> {
    context.beginSubmit();

    try {
        await UsersConnection.login({ login: context.email, password: context.password });
        context.finishSignIn();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
