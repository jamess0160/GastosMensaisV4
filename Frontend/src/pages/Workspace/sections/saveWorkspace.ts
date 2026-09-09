import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { WorkspaceContext } from "../controller";

/** Renomear o espaço.
 *
 *  `PUT /Workspaces` NÃO recebe id no caminho: ele edita o workspace
 *  SELECIONADO NA SESSÃO. Não é economia de rota — é a mesma regra do
 *  resto do contrato, em que o workspace vive dentro do token e nunca
 *  numa query string. A consequência para a tela é direta: só se edita o
 *  espaço em que se está, e por isso o lápis de outro espaço troca a
 *  sessão antes de abrir esta tela.
 *
 *  Só o `owner` passa: quem não é leva 403. A tela nem oferece o campo
 *  nesse caso, mas a mensagem do servidor continua sendo o que aparece
 *  se o caminho escapar.
 *
 *  Depois de gravar, a lista de workspaces da sessão está velha — o nome
 *  aparece na sidebar, em toda tela. */
export async function saveWorkspace(context: WorkspaceContext): Promise<void> {
    const name = context.name.trim();

    if (!name) {
        context.failSubmit("name", "Informe o nome do espaço.");
        return;
    }

    context.beginSubmit("name");

    try {
        await WorkspacesConnection.update(name);
        context.refreshWorkspaces();
        context.finishSubmit("name", "Nome do espaço atualizado.");
    } catch (cause) {
        context.failSubmit("name", errorMessage(cause));
    }
}
