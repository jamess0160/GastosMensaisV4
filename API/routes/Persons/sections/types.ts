export namespace PersonsNamespace {

    //  Só o nome. O IdUser **não** entra: ele é o vínculo com um login, é único no banco
    //  inteiro (não por workspace) e quem o escreve é o cadastro do usuário. Ver POST/create.ts.
    export interface CreatePersonPayload {
        Name: string
    }

    export interface UpdatePersonPayload {
        Name: string
    }
}
