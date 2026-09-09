import { http } from "./client";
import type { ApiTypes } from "@/types/api";

/** `/Tags` — duas rotas só, e é de propósito. A tag não tem
 *  cadastro: ela nasce do texto digitado no lançamento do gasto. Não há
 *  POST (seriam dois passos para uma etiqueta) nem PUT (renomear mudaria
 *  a etiqueta de todos os gastos já marcados). */
class Connection {
    private readonly route = "/Tags";

    /** O input de sugestão enquanto se digita. Busca ILIKE com curingas
     *  escapados e resultado limitado. */
    async search(search?: string): Promise<ApiTypes.Tag[]> {
        const { data } = await http.get<ApiTypes.Tag[]>(`${this.route}/search`, {
            params: { Search: search },
        });
        return data;
    }

    /** Arquiva. Digitar de novo um nome arquivado desarquiva a linha — é
     *  o único caminho de restauração que existe. */
    async archive(idTag: number): Promise<{ msg: string }> {
        const { data } = await http.delete<{ msg: string }>(`${this.route}/IdTag=${idTag}`);
        return data;
    }
}

export const TagsConnection = new Connection();
