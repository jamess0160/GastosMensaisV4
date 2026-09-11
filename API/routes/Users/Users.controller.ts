import { AcessControl } from './sections/AcessControl.section'
import { Request, Response } from "express"
import { Database } from "root/Utils/database"
import { ValidateLogin } from './sections/POST/validateLogin'
import { Create } from './sections/POST/create'
import { Update } from './sections/PUT/update'
import { UpdatePassword } from './sections/PUT/updatePassword'
import { GetSelf } from './sections/GET/getSelf'
import { ForgotPassword } from './sections/POST/forgotPassword'
import { ResetPassword } from './sections/POST/resetPassword'
import { ConfirmEmail } from './sections/POST/confirmEmail'
import { ResendConfirmation } from './sections/POST/resendConfirmation'
import { AcceptTerms } from './sections/POST/acceptTerms'
import { Remove } from './sections/DELETE/remove'

class Controller {

    validateLogin = async (req: Request, res: Response) => {
        let { login, password, RememberDevice } = req.body

        res.json(await new ValidateLogin().run(res, login, password, RememberDevice))
    }

    //  Chama o AcessControl direto, sem section: a regra do projeto é que nada além dele emita
    //  ou apague sessão, e uma sections/POST/logout.ts que só repassasse a chamada daria um
    //  segundo lugar por onde a sessão termina.
    //
    //  Sempre 200, com ou sem sessão: o cookie sai sobrescrito de qualquer forma.
    logout = async (req: Request, res: Response) => {
        AcessControl.clearTokenCookie(res)

        res.json({ msg: "Sessão encerrada com sucesso" })
    }

    forgotPassword = async (req: Request, res: Response) => {
        res.json(await new ForgotPassword().run(req.body.Email))
    }

    resetPassword = async (req: Request, res: Response) => {
        res.json(await new ResetPassword().run(req.body.Token, req.body.NewPassword))
    }

    confirmEmail = async (req: Request, res: Response) => {
        res.json(await new ConfirmEmail().run(req.body.Token))
    }

    resendConfirmation = async (req: Request, res: Response) => {
        res.json(await new ResendConfirmation().run(req.body.Email))
    }

    acessMiddleware = (req: Request, res: Response) => {
        //  A sessão vem do cookie httpOnly, e só dele. O front e a API são servidos pelo mesmo
        //  domínio (www.gastosmensais.com.br e .../api pelo proxy do nginx), então são a mesma
        //  origem: o navegador anexa o cookie sozinho, sem CORS e sem preflight.
        //
        //  httpOnly significa que o JavaScript da página não alcança o token — um XSS não
        //  consegue copiá-lo para fora. Em troca, o cookie viaja sozinho em toda requisição
        //  para o domínio, inclusive nas que partem de outro site: quem fecha esse buraco é o
        //  sameSite:'strict' do setTokenCookie, não o CORS (CORS decide quem lê a resposta,
        //  não quem envia a requisição).
        let token = req.cookies?.token

        if (!token) {
            res.status(401).send()
            return false
        }

        let result = AcessControl.verifyJwtToken(token)

        if (!result) {
            res.status(401).send()
            return false
        }

        //  Os dois dados da sessão saem do mesmo token assinado: quem está pedindo, e de onde.
        //
        //  O IdWorkspace não pode ter sido forjado pelo cliente — a assinatura garante isso —
        //  mas pode estar VELHO: ele foi gravado quando o token foi emitido, e a matrícula pode
        //  ter sido revogada ou o papel rebaixado desde então. Por isso cada rota de tenant
        //  continua passando pelo assertMember/assertRole antes de ler ou escrever.
        res.locals.IdUser = result.id
        res.locals.IdWorkspace = result.IdWorkspace

        //  A duracao vem do token, e nao de um default: e ela que o switch reemite. Token
        //  antigo, emitido antes desta etapa, nao tem a chave - e ai o default e 24h, que e o
        //  que aquele token realmente vale.
        res.locals.RememberDevice = result.RememberDevice === true

        return true
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser, res))
    }

    //  A conta que aceita é a do token, e não há corpo: nem quem, nem com o que, vem do
    //  cliente. É a mesma forma do logout — a rota inteira é um ato, não uma edição.
    acceptTerms = async (req: Request, res: Response) => {
        res.json(await new AcceptTerms().run(res.locals.IdUser))
    }

    create = async (req: Request, res: Response) => {
        res.json(await new Create().run(req.body))
    }

    update = async (req: Request, res: Response) => {
        res.json(await new Update().run(Number(req.params.IdUser), req.body))
    }

    updatePassword = async (req: Request, res: Response) => {
        res.json(await new UpdatePassword().run(res.locals.IdUser, req.body.oldPassword, req.body.newPassword))
    }

    //  A conta que se apaga é a do token, e o cookie sai junto — pelo mesmo AcessControl do
    //  logout, que é a regra do projeto: nada além dele emite ou apaga sessão.
    //
    //  A ORDEM IMPORTA, e é o inverso da do logout. Ali o cookie some sempre; aqui ele só some
    //  DEPOIS de a section ter voltado sem erro. Senha errada (401) e dono de espaço
    //  compartilhado (406) sobem pelo AsyncHandler e nunca chegam nesta linha: quem continua
    //  com a conta de pé não pode perder a sessão no mesmo clique.
    remove = async (req: Request, res: Response) => {
        let result = await new Remove().run(res.locals.IdUser, req.body.Password)

        AcessControl.clearTokenCookie(res)

        res.json(result)
    }
}

export const Users_controller = new Controller()

export interface UserRegister extends Database.Users {
    UserGroups?: number[]
}