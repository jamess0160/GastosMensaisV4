import { errorMessage } from "@/api/client";
import { WorkspacesConnection } from "@/api/Workspaces.connection";
import type { ApiTypes } from "@/types/api";

/** O que a criação de espaço precisa saber e avisar. É menor que o
 *  contexto da tela do espaço de propósito: quem dispara isto é o
 *  seletor do chassi, que não tem formulário nenhum além do nome. */
export interface CreateWorkspaceContext {
    name: string;
    beginSubmit(): void;
    failSubmit(message: string): void;
    /** Criado E já operando nele — o `switch` depois do `POST` já
     *  aconteceu. */
    finishCreate(workspace: ApiTypes.Workspace): void;
}

/** Criar um espaço novo.
 *
 *  São DUAS chamadas, e a segunda é a que se esquece — a mesma armadilha
 *  do aceite de convite. `POST /Workspaces` cria o workspace com o
 *  usuário da sessão como dono e **não troca a sessão**: o cookie
 *  continua apontando para onde se estava, porque trocar o workspace
 *  debaixo da tela que o usuário estava usando é pior do que um clique a
 *  mais. Sem o `switch` em seguida, ele cria o espaço e continua vendo o
 *  antigo, sem erro nenhum na tela — só confusão.
 *
 *  Aqui o `switch` é o certo justamente porque o gesto foi explícito: a
 *  pessoa acabou de nomear um espaço para usar.
 *
 *  O espaço nasce VAZIO — sem contas, sem categorias próprias, sem
 *  lançamentos —, com a matrícula `owner` e com a Person do usuário já
 *  criada dentro dele, porque todo rateio é entre pessoas. Nada disso é
 *  trabalho do cliente: é a mesma transaction do servidor. */
export async function createWorkspace(
    context: CreateWorkspaceContext,
    switchWorkspace: (idWorkspace: number) => Promise<ApiTypes.Workspace>,
): Promise<void> {
    const name = context.name.trim();

    if (!name) {
        context.failSubmit("Informe o nome do espaço.");
        return;
    }

    context.beginSubmit();

    try {
        const { IdWorkspace } = await WorkspacesConnection.create({ Name: name });
        const workspace = await switchWorkspace(IdWorkspace);
        context.finishCreate(workspace);
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
