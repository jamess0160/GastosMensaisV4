import Joi from "joi"
import { joiController } from "root/Utils/joiController"

//  tlds desligado: por padrão o Joi confere o domínio contra a lista da IANA, o que recusa
//  domínio interno de empresa e o .local usado nos testes. Aqui interessa a forma do e-mail,
//  não se o TLD existe — quem diz se o endereço é real é a confirmação por e-mail.
const emailOptions = { tlds: { allow: false } }

class Schema {

    public readonly validateLogin = [
        joiController.validateBody(Joi.object({
            login: Joi.string().trim().lowercase().required(),
            password: Joi.string().trim().required(),
        })),
    ]

    //  Espelha a linha de Users, menos o Password: o hash nunca sai da API.
    //  As datas chegam aqui como Date (o res.json só serializa depois da validação).
    public readonly getSelf = [
        joiController.validateResponse(Joi.object({
            IdUser: Joi.number().required(),
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().required(),
            Phone: Joi.number().required(),
            LastLogin: Joi.date().required(),
            TrialStartAt: Joi.date().required(),
            TrialEndAt: Joi.date().allow(null).required(),
            Active: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        })),
    ]

    //  O lowercase no Email é obrigatório: o validateLogin já normaliza o login, então gravar
    //  "Tiago@X.com" aqui deixaria o usuário sem conseguir entrar pela própria conta.
    public readonly create = [
        joiController.validateBody(Joi.object({
            //  PENDÊNCIA CONHECIDA (etapa 9 do ROADMAP.md): esta rota é pública e este campo
            //  entra direto como matrícula 'owner', sem convite nem conferência de dono. Um
            //  IdWorkspace chutado (são sequenciais) dá acesso ao workspace alheio. Vai ser
            //  substituído por um InviteToken assinado; até lá, não subir para produção.
            IdWorkspace: Joi.number().optional(),
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
            Password: Joi.string().trim().required(),
            Phone: Joi.number().required(),
        })),
        //  O cadastro devolve o workspace criado junto: é por ele que o cliente escopa
        //  todo o resto, e sem isso precisaria de um GET extra logo depois do login.
        joiController.validateResponse(Joi.object({
            IdUser: Joi.number().required(),
            IdWorkspace: Joi.number().required(),
        })),
    ]

    public readonly update = [
        joiController.validateParams(Joi.object({
            IdUser: Joi.number().required(),
        })),
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
            Phone: Joi.number().required(),
        })),
    ]

    public readonly updatePassword = [
        joiController.validateBody(Joi.object({
            oldPassword: Joi.string().trim().required(),
            newPassword: Joi.string().trim().required(),
        })),
    ]
}

export const Users_schema = new Schema()