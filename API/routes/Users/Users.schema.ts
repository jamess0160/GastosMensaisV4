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
            //  O "manter conectado": 30 dias em vez das 24h. Default false, e opcional - um
            //  cliente que nao conhece o campo continua ganhando a sessao de sempre.
            RememberDevice: Joi.boolean().optional().default(false),
        })),
    ]

    //  Sem body e sem params: a rota não recebe nada, o efeito dela é o Set-Cookie. Só a
    //  resposta é descrita, para o msg ficar preso ao contrato como nas demais.
    public readonly logout = [
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
        })),
    ]

    //  O Email normalizado para minusculas pelo mesmo motivo do login: e assim que ele foi
    //  gravado no cadastro, e "Tiago@X.com" precisa reencontrar a conta.
    //
    //  A resposta e uma msg fixa, e e isso que impede a rota de virar um verificador de quais
    //  e-mails tem conta: ela e a mesma para e-mail cadastrado e para e-mail que nao existe.
    public readonly forgotPassword = [
        joiController.validateBody(Joi.object({
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
        })),
    ]

    //  Token e senha no CORPO, nunca na URL: o path cai no log de acesso do proxy, no
    //  historico do navegador e no header Referer - e aqui os dois campos sao credencial.
    public readonly resetPassword = [
        joiController.validateBody(Joi.object({
            Token: Joi.string().trim().required(),
            NewPassword: Joi.string().trim().required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
        })),
    ]

    //  O Token no CORPO, como no resetPassword: ele chega pela query do link do e-mail, e o
    //  que a tela faz com ele e um POST. Na URL da API o path cairia no log de acesso do
    //  proxy e no header Referer - e um GET que muda estado seria gasto pelo pre-carregador
    //  de link do cliente de e-mail, confirmando um endereco que ninguem abriu.
    public readonly confirmEmail = [
        joiController.validateBody(Joi.object({
            Token: Joi.string().trim().required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
        })),
    ]

    //  Mesma forma do forgotPassword, e pelo mesmo motivo: o lowercase para reencontrar a
    //  conta gravada em minusculas, e uma msg fixa que e a mesma para e-mail que tem conta e
    //  para e-mail que nao tem.
    public readonly resendConfirmation = [
        joiController.validateBody(Joi.object({
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
        })),
        joiController.validateResponse(Joi.object({
            msg: Joi.string().required(),
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
            //  E o que a faixa da tela le para saber se aparece: nulo = ainda nao confirmado.
            EmailConfirmedAt: Joi.date().allow(null).required(),
            //  O aceite dos termos: quando, e com qual versão do documento. Nulos nos dois
            //  para quem se cadastrou antes de eles existirem — não houve backfill. Estão
            //  aqui porque o getSelf devolve a LINHA (menos o Password), e uma coluna que
            //  o schema não descreve derruba a rota com 406 pelo unknown.
            TermsAcceptedAt: Joi.date().allow(null).required(),
            TermsVersion: Joi.string().allow(null).required(),
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
            //  Entrar num workspace já existente agora exige convite, e o que a rota aceita é
            //  o hash dele — nunca o IdWorkspace, que era o buraco: id sequencial se adivinha
            //  contando e entrava direto como matrícula 'owner' do tenant alheio.
            //
            //  Mandar IdWorkspace é 406 pelo unknown do Joi, e isso é de propósito: um cliente
            //  antigo tem que falhar alto, não ganhar um workspace próprio em silêncio.
            InviteHash: Joi.string().trim().optional(),
            Name: Joi.string().trim().required(),
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
            Password: Joi.string().trim().required(),
            Phone: Joi.number().required(),
            //  O aceite dos termos, obrigatório e obrigatoriamente `true`: `valid(true)` é o
            //  que faz `false` responder 406 em vez de criar a conta com o campo desmarcado.
            //  Antes desta linha a validação era do cliente e só dele — um POST por curl
            //  criava a conta sem aceitar nada, porque o campo não existia para ser exigido.
            //
            //  **A versão NÃO vem aqui.** O que o cliente afirma é que aceitou; COM O QUE ele
            //  concordou quem diz é a API, com o `TERMS_VERSION` dela. Aceitar a versão do
            //  corpo seria aceitar que o cliente dissesse ter concordado com um documento
            //  antigo, que é o oposto do que a coluna serve para provar.
            AcceptedTerms: Joi.boolean().valid(true).required(),
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