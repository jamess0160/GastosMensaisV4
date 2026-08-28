export namespace CategoriesNamespace {

    export interface CreateCategoryPayload {
        Description: string
        /** Categoria pai. Precisa ser visível ao workspace — a própria ou uma global. */
        IdParentCategory: number | null
        /** Chave do catálogo de ícones do app cliente, não um caminho de arquivo. */
        IconKey: string | null
        Color: string | null
        Position: number | null
    }

    //  Tudo opcional menos a Description: o PUT aceita edição parcial, e não enviar um campo
    //  é deixá-lo como está — não apagá-lo por omissão.
    //
    //  O IdParentCategory é a exceção que obriga a section a olhar `in body`: aqui `undefined`
    //  (mantém o pai) e `null` (promove a raiz) são pedidos diferentes.
    export interface UpdateCategoryPayload {
        Description: string
        IdParentCategory?: number | null
        IconKey?: string | null
        Color?: string | null
        Position?: number | null
    }
}
