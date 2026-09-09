import { generateRegistrationOptions } from "@simplewebauthn/server"
import { APIError } from "root/Utils/Logs"
import { Users_model } from "root/routes/Users/Users.model"
import { UsersAuth_model } from "../../UsersAuth.model"
import { WebAuthnChallenge } from "../WebAuthnChallenge.section"
import { WebAuthnConfig } from "../WebAuthnConfig.section"

//  Passo 1 do cadastro da biometria. Roda autenticado: só quem já provou quem é por senha
//  pode pendurar uma passkey na própria conta.
export class GetRegisterOptions {
    public async run(IdUser: number) {
        let user = await Users_model.getUnique(IdUser)

        if (!user) throw new APIError({ msg: "Usuário não encontrado!", status: 406 })

        let registered = await UsersAuth_model.getByUser(IdUser)

        let options = await generateRegistrationOptions({
            rpName: WebAuthnConfig.rpName,
            rpID: WebAuthnConfig.rpID,
            userName: user.Email,
            userDisplayName: user.Name,
            //  ID estável: é o que faz o autenticador substituir a passkey antiga do mesmo
            //  usuário em vez de acumular uma nova a cada registro. Vai o IdUser e nada mais,
            //  porque este campo fica gravado no aparelho e não é lugar de dado pessoal.
            //  Uint8Array.from e não TextEncoder: a lib pede um Uint8Array respaldado por
            //  ArrayBuffer, e o encode() devolve ArrayBufferLike (que aceita SharedArrayBuffer).
            userID: Uint8Array.from(Buffer.from(String(user.IdUser), "utf8")),
            attestationType: "none",
            //  Impede registrar duas vezes o mesmo autenticador: o navegador já recusa antes
            //  de incomodar o usuário com a digital.
            excludeCredentials: registered.map((credential) => ({ id: credential.CredentialId })),
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "preferred",
                //  'platform': a digital/rosto do próprio aparelho, não chave física externa.
                authenticatorAttachment: "platform",
            },
        })

        return {
            options,
            ChallengeToken: WebAuthnChallenge.sign({ challenge: options.challenge, type: "register", IdUser }),
        }
    }
}
