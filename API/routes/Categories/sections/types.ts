export namespace CategoriesNamespace {

    //  O único recorte da listagem. Opcional no tipo porque é o Joi da query que põe o
    //  default — sem parâmetro, a lista de hoje, sem arquivada.
    export interface ListFilters {
        /** Traz as arquivadas junto com o resto. O mesmo recorte do IncludeCanceled de Expenses. */
        IncludeArchived?: boolean
    }

    export interface CreateCategoryPayload {
        Description: string
        /** Chave do catálogo de ícones do app cliente, não um caminho de arquivo. */
        IconKey: string | null
        Color: string | null
        Position: number | null
    }

    //  Tudo opcional menos a Description: o PUT aceita edição parcial, e não enviar um campo
    //  é deixá-lo como está — não apagá-lo por omissão.
    export interface UpdateCategoryPayload {
        Description: string
        IconKey?: string | null
        Color?: string | null
        Position?: number | null
        /** Arquiva (false) e desarquiva (true). É a mesma coluna que o DELETE zera. */
        Active?: boolean
    }

    //  A lista COMPLETA de ids das categorias ativas do espaço, na ordem desejada. Ver
    //  sections/PUT/reorder.ts para por que a lista inteira, e não um par (id, posição).
    export interface ReorderCategoriesPayload {
        IdCategories: number[]
    }
}
