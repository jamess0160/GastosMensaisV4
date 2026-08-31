import { errorMessage } from "@/api/client";
import { CategoriesConnection } from "@/api/Categories.connection";
import type { SettingsContext } from "../controller";

/** Criar ou editar uma categoria.
 *
 *  `IconKey` é CHAVE do catálogo de ícones do cliente, não caminho de
 *  arquivo — é por isso que a API chama de `IconKey` aqui e de
 *  `IconPath` em Accounts. O desenho vive em `src/ui/iconCatalog.tsx`.
 *
 *  Categoria pré-definida do sistema (`IdWorkspace: null`) não chega
 *  aqui: a tela não abre o formulário para ela, porque a API responde
 *  406 e o botão só existiria para falhar. */
export async function saveCategory(context: SettingsContext): Promise<void> {
    const draft = context.categoryDraft;

    if (!draft.Description.trim()) {
        context.failSubmit("Informe o nome da categoria.");
        return;
    }

    context.beginSubmit();

    const body = {
        Description: draft.Description.trim(),
        IconKey: draft.IconKey,
        Color: draft.Color,
    };

    try {
        if (draft.IdCategory === null) {
            await CategoriesConnection.create(body);
            context.finishSubmit("Categoria criada.");
        } else {
            await CategoriesConnection.update(draft.IdCategory, body);
            context.finishSubmit("Categoria atualizada.");
        }
        context.resetCategoryDraft();
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
