import bcrypt from 'bcrypt'

//  Ponto único de senha da API. A senha chega em texto puro pelo body (protegida pelo HTTPS)
//  e só existe em memória até virar hash aqui — nada de criptografia no cliente: o que o
//  cliente mandasse pronto viraria a credencial efetiva e o hash vazado poderia ser replayado.
class Controller {

    //  Custo do bcrypt. Subir o número dobra o tempo de cálculo a cada incremento; hashes
    //  antigos continuam válidos porque o custo vai gravado no próprio hash.
    private readonly cost = 12

    public hash(password: string) {
        return bcrypt.hash(password, this.cost)
    }

    public compare(password: string, hash: string) {
        return bcrypt.compare(password, hash)
    }
}

export const PasswordHasher = new Controller()
