export namespace UsersNamespace {
    export interface CreateUserPayload {
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