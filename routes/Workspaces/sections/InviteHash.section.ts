import crypto from "crypto"

//  O segredo do convite: 32 bytes aleatórios, e é ele que viaja na URL do link.
//
//  base64url e não base64 comum pelo mesmo motivo escrito no DeviceKey da biometria — ele vai
//  como parâmetro de caminho, e o base64 traz '+', '/' e '=', que precisariam de escape.
//
//  A geração é duplicada de propósito em vez de importar a do UsersAuth: convite e biometria
//  são features sem relação nenhuma, e três linhas repetidas custam menos que o acoplamento.
//
//  O prazo padrão é de 7 dias. Ele é conferido no aceite, mas a trava de verdade contra o
//  aceite duplo não é o prazo nem o Status: é o unique(IdWorkspace, IdUser) de WorkspaceMembers.
class Controller {

    public readonly expirationDays = 7

    public generate() {
        return crypto.randomBytes(32).toString("base64url")
    }

    public buildExpiration(from = new Date()) {
        return new Date(from.getTime() + this.expirationDays * 24 * 60 * 60 * 1000)
    }
}

export const InviteHash = new Controller()
