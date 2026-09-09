import crypto from "crypto"

//  Identificador do aparelho, gerado pela API e guardado pelo cliente. Não é credencial:
//  quem autentica é a assinatura da passkey. Ele só responde "que credenciais oferecer neste
//  aparelho" e "já perguntei sobre biometria aqui".
//
//  base64url porque ele viaja como parâmetro de URL no checkDevice e nas options de login —
//  o base64 comum do V3 traz '+', '/' e '=', que precisam de escape.
class Controller {

    public generate() {
        return crypto.randomBytes(32).toString("base64url")
    }
}

export const DeviceKey = new Controller()
