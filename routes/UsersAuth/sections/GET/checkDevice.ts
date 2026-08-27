import { TrustedDevices_model } from "../../TrustedDevices.model"
import { UsersAuth_model } from "../../UsersAuth.model"
import { UsersAuthNamespace } from "../types"

//  Responde o que a tela de abertura precisa saber sobre este aparelho, antes de haver token.
//
//  Três estados, como no checkUser do V3:
//    true  -> tem passkey aqui, peça a digital
//    false -> o usuário já recusou aqui, vá direto para a senha e não pergunte de novo
//    null  -> aparelho novo, ofereça o cadastro da biometria depois do login
//
//  Rota pública sem vazamento: o DeviceKey é um segredo de 32 bytes que só existe no próprio
//  aparelho, e a resposta não diz de quem é a conta.
export class CheckDevice {
    public async run(deviceKey: string): Promise<{ UseAuth: UsersAuthNamespace.UseAuth }> {
        let [credentials, skipped] = await Promise.all([
            UsersAuth_model.getByDeviceKey(deviceKey),
            TrustedDevices_model.getByDeviceKey(deviceKey),
        ])

        //  A passkey vence a recusa: o register apaga o "pulei" do aparelho, mas se as duas
        //  linhas existirem por qualquer motivo, quem tem credencial consegue entrar.
        if (credentials.length) return { UseAuth: true }

        if (skipped.length) return { UseAuth: false }

        return { UseAuth: null }
    }
}
