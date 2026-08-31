import { errorMessage } from "@/api/client";
import { CategoriesConnection } from "@/api/Categories.connection";
import type { SettingsContext } from "../controller";

/** Arquivar uma categoria.
 *
 *  É soft delete: a linha fica e o histórico continua apontando para
 *  ela. Um gasto de março não perde a categoria porque ela saiu do
 *  cadastro em agosto.
 *
 *  A categoria do sistema recusa com 406 — a tela desabilita o botão
 *  antes, mas a mensagem da API é mostrada como veio se ele escapar. */
export async function archiveCategory(context: SettingsContext, idCategory: number): Promise<void> {
    context.beginSubmit();

    try {
        await CategoriesConnection.archive(idCategory);
        context.finishSubmit("Categoria arquivada.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
