export namespace UsersNamespace {
    export interface CreateUserPayload {
        //  O hash do convite, no lugar do IdWorkspace que esta rota aceitava: id sequencial se
        //  adivinha contando, 32 bytes aleatórios não. Ausente = workspace próprio, novo.
        InviteHash?: string
        Name: string
        Email: string
        Password: string
        Phone: number
    }

    export interface UpdateUserPayload {
        Name: string
        Email: string
        Phone: number
    }
}