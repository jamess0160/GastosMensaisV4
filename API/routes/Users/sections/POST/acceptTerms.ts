import { APIError } from "root/Utils/Logs"
import { Users_model } from "../../Users.model"
import { TERMS_VERSION } from "../TermsVersion"

//  O re-aceite dos termos, para quem já tem conta.
//
//  **Não é um campo do `PUT /Users`.** O `update` descarta o `AcceptedTerms` de propósito, e o
//  aceite não é a edição de um campo do perfil: é um ato, com data própria, que só pode ser
//  praticado no presente. Uma rota própria é o que torna isso verdade no código.
//
//  **Sem corpo.** A versão sai do servidor pelo mesmo motivo do cadastro: aceitar a versão que
//  o cliente mandasse seria aceitar que ele afirmasse ter concordado com um documento antigo,
//  que é o oposto do que a coluna prova. O que o cliente diz é "aceito", e quem responde COM O
//  QUE é o `TERMS_VERSION`.
export class AcceptTerms {
    public async run(IdUser: number) {
        let user = await Users_model.getUnique(IdUser)

        //  Mesma resposta do `getSelf` para a conta que sumiu debaixo de um token ainda válido
        //  — só sem apagar o cookie, que é o `getSelf` da tela seguinte quem faz.
        if (!user) {
            throw new APIError({ msg: "Usuário não encontrado!", status: 406 })
        }

        //  **Idempotente, como o `confirmEmail`.** Aceitar de novo a versão que já está gravada
        //  não reescreve a data: ela é a prova de QUANDO esta pessoa concordou com ESTE texto,
        //  e um segundo clique — ou uma segunda aba com o modal aberto — moveria o instante da
        //  prova para o do clique repetido. O modal só aparece para quem está desatualizado,
        //  então pelo caminho normal esta guarda nunca é o caso.
        if (user.TermsVersion !== TERMS_VERSION) {
            await Users_model.acceptTerms(IdUser)
        }

        return { msg: "Termos aceitos com sucesso" }
    }
}
