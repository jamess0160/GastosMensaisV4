import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { enviromentManager } from 'root/Utils/enviromentManager'
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
}

class Controller {

    //  Fim de linha de todo login, seja por senha ou por biometria: é o único ponto que
    //  transforma uma credencial já validada em sessão. Quem valida a credencial não emite
    //  token por conta própria, para os dois caminhos não divergirem no que gravam.
    async startSession(res: Response, IdUser: number) {
        //  Selecionar aqui é o que evita um switch obrigatório depois de todo login.
        let IdWorkspace = await new SelectDefault().run(IdUser)

        this.setTokenCookie(res, IdUser, IdWorkspace)

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
    generateToken(IdUser: number, IdWorkspace?: number): string {
        return jwt.sign({ id: IdUser, IdWorkspace }, enviromentManager.getEnv("JWT_SECRET"), { expiresIn: "24h" })
    }

    verifyJwtToken(token: string): null | TokenPayload {
        try {
            return jwt.verify(token, enviromentManager.getEnv("JWT_SECRET")) as TokenPayload
        } catch (error: any) {
            return null
        }
    }

    setTokenCookie(res: Response, IdUser: number, IdWorkspace: number): void {
        const token = this.generateToken(IdUser, IdWorkspace)
        res.cookie('token', token, {
            httpOnly: true,
            secure: this.isProduction(),
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        })
    }

    //  Emissão e remoção ficam lado a lado de propósito: o navegador casa cookie por (nome,
    //  domínio, path) e só APAGA o que ele reconhece como o mesmo cookie. Os atributos abaixo
    //  repetem os de cima — inclusive o Path, que hoje é o default ('/') nos dois. Mudar um sem
    //  mudar o outro não dá erro nenhum: cria um segundo cookie ao lado e a sessão não morre.
    clearTokenCookie(res: Response): void {
        res.clearCookie('token', {
            httpOnly: true,
            secure: this.isProduction(),
            sameSite: 'strict'
        })
    }

    //  Todo acesso a env passa pelo enviromentManager, e este é opcional: em desenvolvimento e
    //  em teste a variável simplesmente não existe, e a ausência dela é a resposta 'não é
    //  produção' — não um erro de boot como seria numa variável obrigatória.
    private isProduction(): boolean {
        return enviromentManager.getEnv("NODE_ENV", true) === "production"
    }

}

export const AcessControl = new Controller()
