import { AcessControl } from './sections/AcessControl.section'
import { Request, Response } from "express"
import { Database } from "root/Utils/database"
import { ValidateLogin } from './sections/POST/validateLogin'
import { Create } from './sections/POST/create'
import { Update } from './sections/PUT/update'
import { UpdatePassword } from './sections/PUT/updatePassword'
import { GetSelf } from './sections/GET/getSelf'

class Controller {

    validateLogin = async (req: Request, res: Response) => {
        let { login, password } = req.body

        res.json(await new ValidateLogin().run(res, login, password))
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

        return true
    }

    getSelf = async (req: Request, res: Response) => {
        res.json(await new GetSelf().run(res.locals.IdUser))
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
}

export const Users_controller = new Controller()

export interface UserRegister extends Database.Users {
    UserGroups?: number[]
}