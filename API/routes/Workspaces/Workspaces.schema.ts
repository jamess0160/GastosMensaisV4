import Joi from "joi"
import { joiController } from "root/Utils/joiController"

//  Mesma opção do schema de Users: por padrão o Joi confere o TLD contra a lista da IANA, o que
//  recusa domínio interno e o .local dos testes. Aqui interessa a forma do e-mail.
const emailOptions = { tlds: { allow: false } }

//  'owner' fica de fora de propósito: propriedade não se convida, se transfere — e transferir é
//  operação própria, que continua na etapa 9 do ROADMAP.
const inviteRole = Joi.string().valid("editor", "viewer")

//  A listagem de membros tem os TRÊS papéis. 'owner' não se convida, mas é justamente ele
//  quem mais aparece aqui — reusar o inviteRole faria a resposta do dono não validar.
const memberRole = Joi.string().valid("owner", "editor", "viewer")

class Schema {

    //  Só o nome. IdOwnerUser vem do token, e não há IdWorkspace a receber: ele nasce nesta
    //  chamada. Mesma forma do Name do update, que edita o mesmo campo.
    public readonly create = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
        //  Só o id, como todo POST do projeto: a linha inteira o cliente busca no getSelf, que
        //  é onde ela já ia aparecer na lista de workspaces.
        joiController.validateResponse(Joi.object({
            IdWorkspace: Joi.number().required(),
        })),
    ]

    //  O Current é o único campo daqui que não sai da tabela: ele responde "é este o workspace
    //  do token desta requisição?". Sem ele o cliente não teria como saber — a seleção vive
    //  dentro do JWT e o cookie é HttpOnly —, e acabaria chutando o primeiro da lista.
    public readonly getSelf = [
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdWorkspace: Joi.number().required(),
            Name: Joi.string().trim().required(),
            IdOwnerUser: Joi.number().required(),
            Current: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        }))),
    ]

    //  Única rota que recebe IdWorkspace do cliente: é ela que decide qual vai para o token.
    public readonly switch = [
        joiController.validateBody(Joi.object({
            IdWorkspace: Joi.number().required(),
        })),
        //  Mesma forma da linha do getSelf, Current inclusive: é a resposta de quem ACABOU de
        //  ser selecionado, então ele é sempre true. Um formato só para o mesmo objeto poupa o
        //  cliente de ter dois tipos de workspace.
        joiController.validateResponse(Joi.object({
            IdWorkspace: Joi.number().required(),
            Name: Joi.string().trim().required(),
            IdOwnerUser: Joi.number().required(),
            Current: Joi.boolean().required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        })),
    ]

    //  O e-mail vai em lowercase como o de Users: é a comparação do aceite que depende disso —
    //  os dois lados gravados em minúsculas é o que permite comparar direto.
    public readonly createInvite = [
        joiController.validateBody(Joi.object({
            Email: Joi.string().trim().lowercase().email(emailOptions).required(),
            Role: inviteRole.default("editor"),
        })),
        //  Só o hash e a validade voltam: é o que a tela precisa para montar o link. O
        //  IdWorkspace já é o da sessão, e o id da linha só interessa a quem for revogar,
        //  que lê a listagem.
        joiController.validateResponse(Joi.object({
            Hash: Joi.string().required(),
            ExpiresAt: Joi.date().required(),
        })),
    ]

    public readonly getInvites = [
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdWorkspaceInvite: Joi.number().required(),
            IdWorkspace: Joi.number().required(),
            IdInviterUser: Joi.number().required(),
            Email: Joi.string().required(),
            Role: inviteRole.required(),
            //  O Hash sai para o dono, e só para ele: é ele quem entrega o link, e sem isso
            //  reenviar um convite exigiria revogar e criar outro.
            Hash: Joi.string().required(),
            Status: Joi.string().valid("pending", "accepted", "revoked").required(),
            ExpiresAt: Joi.date().required(),
            AcceptedAt: Joi.date().allow(null).required(),
            IdAcceptedUser: Joi.number().allow(null).required(),
            CreatedAt: Joi.date().required(),
            UpdatedAt: Joi.date().required(),
        }))),
    ]

    //  Quem tem acesso ao espaço da sessão. Sem validateParams e sem validateQuery: o
    //  workspace é o do token, e não há filtro nenhum a receber.
    //
    //  A resposta NÃO tem IdUser. O que identifica um membro daqui para frente é o
    //  IdWorkspaceMember: a matrícula é do espaço e já nasce escopada, enquanto o IdUser é
    //  global e atravessa tenants. É o mesmo motivo por que nenhuma rota do projeto aceita
    //  IdUser do cliente.
    public readonly getMembers = [
        joiController.validateResponse(Joi.array().items(Joi.object({
            IdWorkspaceMember: Joi.number().required(),
            //  Nome e e-mail vêm de Users pelo join: sem eles a lista seria uma lista de ids.
            Name: Joi.string().required(),
            Email: Joi.string().required(),
            Role: memberRole.required(),
            //  O CreatedAt da matrícula, renomeado: "quando entrou no espaço" é o que a
            //  coluna significa aqui, e CreatedAt ao lado de um nome de pessoa se leria como
            //  a data do cadastro dela.
            JoinedAt: Joi.date().required(),
            //  Igual ao Current do getSelf: não descreve a linha, descreve o token que
            //  respondeu. É o que deixa a tela não oferecer "remover" no próprio nome — e
            //  comparar e-mail no cliente seria comparar a coisa errada.
            IsSelf: Joi.boolean().required(),
        }))),
    ]

    //  Rota pública: quem recebeu o link ainda pode não ter conta.
    public readonly getInviteByHash = [
        joiController.validateParams(Joi.object({
            Hash: Joi.string().trim().required(),
        })),
        //  NENHUM id na resposta. Quem tem o hash já tem o convite; o que não pode acontecer é
        //  a rota virar sonda para descobrir workspace por id.
        joiController.validateResponse(Joi.object({
            WorkspaceName: Joi.string().allow("").required(),
            InviterName: Joi.string().allow("").required(),
            Email: Joi.string().required(),
            Role: inviteRole.required(),
            ExpiresAt: Joi.date().required(),
        })),
    ]

    //  Só o hash no corpo: o papel vem da linha do convite e o e-mail conferido é o da sessão.
    public readonly join = [
        joiController.validateBody(Joi.object({
            Hash: Joi.string().trim().required(),
        })),
        //  Devolve o workspace em que a matrícula nasceu, para o cliente conseguir chamar o
        //  switch em seguida — o join não reemite o token de propósito.
        joiController.validateResponse(Joi.object({
            IdWorkspace: Joi.number().required(),
        })),
    ]

    public readonly revokeInvite = [
        joiController.validateParams(Joi.object({
            IdWorkspaceInvite: Joi.number().required(),
        })),
    ]

    //  Sem validateParams: o workspace editado é o da sessão, que vem do token.
    public readonly update = [
        joiController.validateBody(Joi.object({
            Name: Joi.string().trim().max(255).required(),
        })),
    ]
}

export const Workspaces_schema = new Schema()
