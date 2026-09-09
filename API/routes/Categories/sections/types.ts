export namespace CategoriesNamespace {

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
    }
}
