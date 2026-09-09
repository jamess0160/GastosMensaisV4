import { UsersAuth_model } from "../../UsersAuth.model"

//  As credenciais do usuário do token, para a tela de "aparelhos com biometria".
export class GetSelf {
    public async run(IdUser: number) {
        let credentials = await UsersAuth_model.getByUser(IdUser)

        //  PublicKey e Counter são detalhe interno do protocolo e não têm uso no cliente:
        //  ficam de fora para a resposta não carregar bytea à toa.
        return credentials.map(({ PublicKey, Counter, ...credential }) => credential)
    }
}
