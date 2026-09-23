import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Categories` — categoria é só de gasto (entrada não tem
 *  categoria) e a lista é plana: categoria não é filha de outra.
 *
 *  **Toda linha é de um workspace.** A pré-definida do sistema
 *  (`IdWorkspace: null`), que todo espaço via e nenhum editava, acabou
 *  na leva 9 — cada espaço tem a sua cópia das treze, e com ela o
 *  direito de renomear, arquivar, desarquivar e reordenar. */
class Connection {
    private readonly route = "/Categories";

    /** As do workspace, ordenadas por `Position`.
     *
     *  `IncludeArchived` ausente esconde a arquivada, e esse padrão é
     *  quem protege as telas: o seletor de gasto, o filtro e o relatório
     *  chamam sem o parâmetro. Só a Personalização pede a lista inteira,
     *  e ela mesma separa os dois grupos. */
    async list(query: ApiTypes.CategoryListQuery = {}): Promise<ApiTypes.Category[]> {
        const { data } = await http.get<ApiTypes.Category[]>(this.route, { params: query });
        return data;
    }

    async create(body: ApiTypes.CategoryCreateBody): Promise<{ IdCategory: number }> {
        const { data } = await http.post<{ IdCategory: number }>(this.route, body);
        return data;
    }

    async update(idCategory: number, body: ApiTypes.CategoryUpdateBody): Promise<{ msg: string }> {
        const { data } = await http.put<{ msg: string }>(
            `${this.route}/IdCategory=${idCategory}`,
            body,
        );
        return data;
    }

    /** Arquiva (`Active = false`) — soft delete: o gasto de março
     *  continua apontando para a categoria em que foi lançado. */
    async archive(idCategory: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdCategory=${idCategory}`,
        );
        return data;
    }

    /** Arquiva e desarquiva pelo mesmo PUT da edição — é a MESMA coluna
     *  que o `archive` zera, e por isso não há rota `restore`.
     *
     *  A `Description` vai junto porque o corpo do PUT a exige: a edição
     *  é parcial no resto, não nela. Quem chama já tem a linha na mão —
     *  está desenhando-a na tela. */
    async setActive(
        idCategory: number,
        description: string,
        active: boolean,
    ): Promise<{ msg: string }> {
        return this.update(idCategory, { Description: description, Active: active });
    }

    /** A ordem das categorias ativas do espaço, pela lista COMPLETA de
     *  ids — nunca "mova o id X para a posição N".
     *
     *  O cliente já tem a ordem inteira na mão, e a escrita parcial é o
     *  que deixaria duas categorias na mesma posição quando duas pessoas
     *  reordenam ao mesmo tempo. Lista incompleta, id repetido ou id que
     *  não é do espaço respondem 406 e não gravam nada. */
    async reorder(idCategories: number[]): Promise<{ msg: string }> {
        const body: ApiTypes.CategoryReorderBody = { IdCategories: idCategories };
        const { data } = await http.put<{ msg: string }>(`${this.route}/reorder`, body);
        return data;
    }
}

export const CategoriesConnection = new Connection();
