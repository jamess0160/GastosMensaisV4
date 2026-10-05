import { Database } from "root/Utils/database"

export namespace TagsNamespace {

    export interface SearchFilters {
        /** Trecho do nome. Sem ele, o input recebe as primeiras tags em ordem de nome. */
        Search?: string
    }

    /**
     * A tag com o gasto ao lado — a linha que `getByExpenses` devolve.
     *
     * O `IdExpense` não é da tag: ele vem do vínculo, e está aqui só para a lista de pernas
     * agrupar em memória sem uma consulta por gasto. Uma tag marcada em dois gastos volta em
     * duas linhas, e quem agrupa descarta a coluna — a resposta leva **a tag inteira**, que é
     * o que o cliente desenha.
     */
    export interface TagOfExpense extends Database.Tags {
        IdExpense: number
    }
}
