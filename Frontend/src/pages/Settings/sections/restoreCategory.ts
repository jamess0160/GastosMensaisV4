import { errorMessage } from "@/api/client";
import { CategoriesConnection } from "@/api/Categories.connection";
import type { SettingsContext } from "../controller";

/** Desarquiva uma categoria.
 *
 *  É a volta do `archiveCategory`, e é o mesmo PUT da edição com
 *  `Active: true` — a mesma coluna que o DELETE zera. Sem ela arquivar
 *  era de mão única: a categoria saía das listas e rota nenhuma a
 *  trazia de volta, o que faz de "arquivar" um delete com outro nome.
 *
 *  A `Description` vai junto porque o corpo do PUT a exige, e a tela a
 *  tem na mão: a linha está desenhada no grupo das arquivadas.
 *
 *  A categoria volta para o FIM da lista, e quem decide isso é a API: a
 *  posição que ela tinha já é de outra, e devolvê-la faria a categoria
 *  reaparecer no meio, numa ordem que ninguém escolheu. */
export async function restoreCategory(
    context: SettingsContext,
    idCategory: number,
    description: string,
): Promise<void> {
    context.beginSubmit();

    try {
        await CategoriesConnection.setActive(idCategory, description, true);
        context.finishSubmit("Categoria desarquivada.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
