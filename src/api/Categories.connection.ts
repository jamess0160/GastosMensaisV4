import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Categories` — categoria é só de gasto (entrada não tem
 *  categoria) e a lista é plana: categoria não é filha de outra. */
class Connection {
    private readonly route = "/Categories";

    /** Devolve as do workspace E as globais juntas, numa lista só.
     *  `IdWorkspace: null` é pré-definida do sistema: aparece em todo
     *  workspace e não pode ser editada nem arquivada (406). Use esse
     *  campo para desabilitar os botões na tela. */
    async list(): Promise<ApiTypes.Category[]> {
        const { data } = await http.get<ApiTypes.Category[]>(this.route);
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

    async archive(idCategory: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(
            `${this.route}/IdCategory=${idCategory}`,
        );
        return data;
    }
}

export const CategoriesConnection = new Connection();
