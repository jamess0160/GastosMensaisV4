import { APIError } from "root/Utils/Logs"
import { Users_model } from "../../Users.model"
import { AcessControl } from "../AcessControl.section"
import { TERMS_VERSION } from "../TermsVersion"
import { Response } from "express"

export class GetSelf {
    public async run(IdUser: number, res: Response) {
        let user = await this.getUser(IdUser)

        if (!user) {
            AcessControl.clearTokenCookie(res)
            throw new APIError({ msg: "Usuário não encontrado!", status: 406 })
        }

        //  O hash da senha não vai para o cliente
        let { Password, ...self } = user

        //  **Quem decide se o aceite está velho é a API, e o cliente não compara nada.** O campo
        //  é DERIVADO, calculado a cada leitura como o `Balance` e o `Spent`: não é coluna e não
        //  é cache, porque o número que decide tem que sair de um lugar só, no instante em que é
        //  lido — a versão vigente muda com um commit, e uma coluna gravada não muda com ele.
        //
        //  A comparação no cliente seria a divergência silenciosa por construção: a versão que
        //  ele conhece é a `LEGAL_VERSION` do `LegalLayout`, em "DD/MM/AAAA", e a que o banco
        //  guarda é esta, em "YYYY-MM-DD". Duas constantes, em dois arquivos e dois formatos,
        //  que precisam concordar — e a comparação ficaria justamente do lado que não grava
        //  nada, então errar não quebraria teste nenhum.
        //
        //  **Nulo conta como desatualizado**, e é a mesma resposta pela mesma razão: não consta
        //  que essa pessoa tenha aceitado coisa nenhuma. Quem se cadastrou antes da leva 7 não
        //  teve backfill (e não deveria ter tido), e quem aceitou uma versão anterior está no
        //  mesmo lugar — os dois caem neste caminho sem um segundo campo para distinguir.
        return { ...self, TermsOutdated: self.TermsVersion !== TERMS_VERSION }
    }

    private getUser(IdUser: number) {
        return Users_model.getUnique(IdUser)
    }
}