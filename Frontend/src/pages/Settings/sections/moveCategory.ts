import { errorMessage } from "@/api/client";
import { CategoriesConnection } from "@/api/Categories.connection";
import type { SettingsContext } from "../controller";

/** Sobe ou desce uma categoria uma posição.
 *
 *  **Setas, e não arrastar.** Arrastar é o gesto óbvio no desktop e
 *  briga com o scroll em 390px, que é a largura em que este produto é
 *  usado — a lista rola no mesmo eixo em que o dedo arrastaria a linha.
 *  Treze linhas e duas setas resolvem o mesmo problema nas duas
 *  larguras, sem um caminho de código por dispositivo.
 *
 *  A rota recebe a lista COMPLETA de ids na ordem nova, não "mova o id
 *  X para a posição N": é o cliente que já tem a ordem inteira na mão, e
 *  é a lista toda que faz a última escrita ganhar inteira em vez de
 *  deixar a ordem meio aplicada. Então o que esta section faz é a troca
 *  de dois vizinhos e o envio do resultado. */
export async function moveCategory(
    context: SettingsContext,
    idCategory: number,
    direction: -1 | 1,
): Promise<void> {
    const ids = context.activeCategories.map((category) => category.IdCategory);
    const from = ids.indexOf(idCategory);
    const to = from + direction;

    /* Primeira linha subindo ou última descendo: não há troca a fazer, e
       mandar a lista igual gastaria uma requisição para nada. A tela já
       desabilita as setas das pontas — isto é o cinto. */
    if (from === -1 || to < 0 || to >= ids.length) return;

    [ids[from], ids[to]] = [ids[to], ids[from]];

    context.beginSubmit();

    try {
        await CategoriesConnection.reorder(ids);
        context.finishSubmit("Ordem salva.");
    } catch (cause) {
        context.failSubmit(errorMessage(cause));
    }
}
