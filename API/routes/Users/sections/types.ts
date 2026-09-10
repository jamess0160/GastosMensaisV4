export namespace UsersNamespace {
    export interface CreateUserPayload {
        //  O hash do convite, no lugar do IdWorkspace que esta rota aceitava: id sequencial se
        //  adivinha contando, 32 bytes aleatórios não. Ausente = workspace próprio, novo.
        InviteHash?: string
        Name: string
        Email: string
        Password: string
        Phone: number
        //  O aceite dos termos. Obrigatório e obrigatoriamente `true` — o Joi recusa tanto a
        //  ausência quanto o `false` com 406. O cliente afirma QUE aceitou; COM O QUE ele
        //  concordou é a API que carimba, com o `TERMS_VERSION` dela.
        AcceptedTerms: boolean
    }

    export interface UpdateUserPayload {
        Name: string
        Email: string
        Phone: number
    }
}