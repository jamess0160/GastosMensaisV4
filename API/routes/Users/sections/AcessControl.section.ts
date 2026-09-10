import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { enviromentManager } from 'root/Utils/enviromentManager'
import { isProduction } from 'root/Utils/environment'
import { Logs } from 'root/Utils/Logs'
import { Utils } from 'root/Utils/Utils'
import { SelectDefault } from 'root/routes/Workspaces/sections/POST/selectDefault'
import { Users_model } from '../Users.model'

Utils.configEnv()

//  A sessão são duas coisas — quem é (IdUser) e em qual workspace está (IdWorkspace) — e as
//  duas viajam dentro do MESMO token assinado.
//
//  Assinado, não criptografado: o payload de um JWT é base64, qualquer um que tenha o token lê
//  o conteúdo. O que a assinatura garante é outra coisa, e é a que interessa aqui — o cliente
//  não consegue trocar o IdWorkspace por outro sem invalidar o token. Nunca coloque segredo
//  neste payload.
//
//  Por que no token e não num cookie próprio: um cookie separado seria dado do cliente, que
//  ele reescreve para qualquer id sequencial. Dentro do token, a assinatura fecha essa porta —
//  e a seleção do workspace passa a viver e morrer junto com a sessão, num cookie só.
export interface TokenPayload {
    id: number
    IdWorkspace: number
    /**
     * A duração escolhida no login, **dentro do token**.
     *
     * Ela precisa viajar aqui porque o `POST /Workspaces/switch` reemite a credencial: se ele
     * reemitisse com o default, trocar de workspace rebaixaria em silêncio uma sessão de 30
     * dias para 24h, e o usuário seria deslogado sem entender por quê.
     */
    RememberDevice?: boolean
}

class Controller {

    /**
     * As duas durações da sessão, em segundos — **e o único lugar onde elas existem**.
     *
     * O `expiresIn` do token e o `maxAge` do cookie eram dois literais neste mesmo arquivo, que
     * coincidiam por sorte. Mudar um sem o outro não dá erro nenhum na hora: deixa cookie vivo
     * com token morto (401 com a credencial na mão) ou cookie morto com token válido. Agora as
     * duas saem daqui, e o cookie só converte para milissegundos.
     *
     * Os números são os que a tela de login já promete: 24h por padrão, 30 dias no "manter
     * conectado".
     */
    private readonly durations = {
        default: 24 * 60 * 60,
        remembered: 30 * 24 * 60 * 60,
    }

    //  Fim de linha de todo login, seja por senha ou por biometria: é o único ponto que
    //  transforma uma credencial já validada em sessão. Quem valida a credencial não emite
    //  token por conta própria, para os dois caminhos não divergirem no que gravam.
    async startSession(res: Response, IdUser: number, RememberDevice = false) {
        //  Selecionar aqui é o que evita um switch obrigatório depois de todo login.
        let IdWorkspace = await new SelectDefault().run(IdUser)

        //  O RememberDevice chega dos DOIS caminhos de login — senha e biometria —, e é essa
        //  convergência num ponto só que impede os dois de divergirem no que gravam.
        this.setTokenCookie(res, IdUser, IdWorkspace, RememberDevice)

        await this.updateLastLogin(IdUser)
    }

    //  O LastLogin é telemetria: falhar aqui não pode derrubar um login que já foi aprovado.
    private async updateLastLogin(IdUser: number) {
        try {
            await Users_model.update(IdUser, { LastLogin: new Date() })
        } catch (error) {
            Logs.handleError("Ocorreu um erro ao atualizar o LastLogin", error, { IdUser })
        }
    }

    //  IdWorkspace undefined não vira chave no payload: o JSON.stringify do jwt.sign descarta.
    //  O RememberDevice false segue o mesmo caminho, e é o que se quer: o token sem a chave é
    //  o token de 24h, que continua sendo o default de quem não pediu nada.
    generateToken(IdUser: number, IdWorkspace?: number, RememberDevice = false): string {
        return jwt.sign(
            { id: IdUser, IdWorkspace, RememberDevice: RememberDevice || undefined },
            enviromentManager.getEnv("JWT_SECRET"),
            { expiresIn: this.duration(RememberDevice) },
        )
    }

    /** Em segundos, que é o que o `expiresIn` do jsonwebtoken entende quando é número. */
    private duration(RememberDevice: boolean) {
        return RememberDevice ? this.durations.remembered : this.durations.default
    }

    verifyJwtToken(token: string): null | TokenPayload {
        try {
            return jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as TokenPayload
        } catch (error: any) {
            return null
        }
    }

    setTokenCookie(res: Response, IdUser: number, IdWorkspace: number, RememberDevice = false): void {
        const token = this.generateToken(IdUser, IdWorkspace, RememberDevice)
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction(),
            sameSite: 'strict',
            //  Mesmo número do expiresIn do token, convertido: os dois saem de `durations`, e
            //  é isso que os impede de divergir.
            maxAge: this.duration(RememberDevice) * 1000
        })
    }

    //  Emissão e remoção ficam lado a lado de propósito: o navegador casa cookie por (nome,
    //  domínio, path) e só APAGA o que ele reconhece como o mesmo cookie. Os atributos abaixo
    //  repetem os de cima — inclusive o Path, que hoje é o default ('/') nos dois. Mudar um sem
    //  mudar o outro não dá erro nenhum: cria um segundo cookie ao lado e a sessão não morre.
    clearTokenCookie(res: Response): void {
        res.clearCookie('token', {
            httpOnly: true,
            secure: isProduction(),
            sameSite: 'strict'
        })
    }

}

export const AcessControl = new Controller()
