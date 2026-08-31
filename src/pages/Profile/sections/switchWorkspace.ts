import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ProfileContext } from "../controller";

/** Trocar o workspace da sessão.
 *
 *  É a ÚNICA rota do contrato que recebe `IdWorkspace` do cliente — e o
 *  motivo é que ela reemite o cookie: o workspace vive dentro do token,
 *  não numa query string.
 *
 *  A consequência é grande e fácil de esquecer: no instante em que o
 *  cookie novo chega, TODO cache de query passa a falar de outro
 *  workspace. Contas, categorias, gastos do mês, orçamentos — nada disso
 *  vale mais. Por isso `resetAllCaches` vem logo depois, e não uma
 *  invalidação seletiva: aqui não há nada que se aproveite. */
export async function switchWorkspace(context: ProfileContext, idWorkspace: number): Promise<void> {
    context.beginSubmit("workspace");

    try {
        const workspace = await WorkspacesConnection.switch(idWorkspace);
        context.resetAllCaches();
        context.finishSubmit("workspace", `Agora você está em ${workspace.Name}.`);
    } catch (cause) {
        context.failSubmit("workspace", errorMessage(cause));
    }
}
