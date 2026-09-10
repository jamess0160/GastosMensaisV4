import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Workspaces_controller } from "./Workspaces.controller"
import { Workspaces_schema } from "./Workspaces.schema"

export const Workspaces_route = express()

//  O primeiro workspace nasce dentro do cadastro (routes/Users/sections/POST/create.ts), na
//  mesma transaction que cria o usuário. Esta rota é para o segundo em diante: quem já tem
//  conta e quer separar as finanças em mais de um lugar. Não recebe IdWorkspace nenhum — o
//  workspace ainda não existe, e o dono é o usuário do token.
//
//  Como o join, NÃO reemite o token: criar dá matrícula, não troca a sessão.
Workspaces_route.post("/Workspaces", Workspaces_schema.create, AsyncHandler(Workspaces_controller.create))

Workspaces_route.get("/Workspaces/getSelf", Workspaces_schema.getSelf, AsyncHandler(Workspaces_controller.getSelf))

//  Escolhe em qual workspace a sessão está. É a única rota que recebe um IdWorkspace escrito
//  pelo cliente, e a única que precisa: nas demais ele vem de dentro do token da sessão.
Workspaces_route.post("/Workspaces/switch", Workspaces_schema.switch, AsyncHandler(Workspaces_controller.switch))

//  Quem tem acesso ao espaço da sessão. Ao contrário das rotas de convite, esta abre com
//  assertMember e não com assertRole: quem divide o espaço tem direito de saber com quem
//  divide — os lançamentos de todos já estão à vista de todos, e esconder a lista só deixaria
//  o editor sem saber a quem pedir uma permissão.
Workspaces_route.get("/Workspaces/members", Workspaces_schema.getMembers, AsyncHandler(Workspaces_controller.getMembers))

//  Troca o papel de quem JÁ é membro — antes disto o papel só se decidia no convite e era
//  imutável depois do aceite. Só o dono (assertRole owner), como as rotas de convite.
//
//  Endereça a MATRÍCULA e não o usuário: ela é do espaço e já nasce escopada, enquanto o IdUser
//  é global e atravessa tenants. Só se anda entre editor e viewer — 'owner' é recusado pelo Joi,
//  porque promover a dono é transferir a propriedade, que tem regra própria.
Workspaces_route.put("/Workspaces/members/IdWorkspaceMember=:IdWorkspaceMember", Workspaces_schema.updateMember, AsyncHandler(Workspaces_controller.updateMember))

//  Tira alguém do espaço. Só o dono (assertRole owner), como o convite e a troca de papel.
//
//  Apaga a matrícula DE VERDADE: não há Active em WorkspaceMembers, porque matrícula inativa é
//  acesso revogado que continua ocupando a chave única e voltaria sozinha num convite futuro.
//  Nada do que a pessoa lançou é tocado — gasto, entrada e conta são do workspace, e o rateio
//  de quem gastou aponta para Persons, que é outra tabela.
//
//  O dono não se remove por aqui: sair é operação do próprio usuário, e ele só sai depois de
//  transferir a propriedade.
Workspaces_route.delete("/Workspaces/members/IdWorkspaceMember=:IdWorkspaceMember", Workspaces_schema.removeMember, AsyncHandler(Workspaces_controller.removeMember))

//  Sair do espaço da sessão — a própria matrícula, sem id no caminho: o id viria do cliente e a
//  rota teria que conferir que é o do próprio usuário, quando a sessão já sabe disso.
//
//  A guarda é a OPOSTA da de cima: assertMember, e depois exige NÃO ser dono. Enquanto ele for
//  dono, sair deixaria o espaço sem quem convida e sem quem remove — e o 406 diz o conserto,
//  transferir a propriedade, em vez do 403 genérico do assertRole.
//
//  NÃO reemite o token, como o join e o create: switch é a única rota que aceita um IdWorkspace
//  escrito pelo cliente, e uma saída não abre exceção nisso. Depois de sair, o cliente chama
//  getSelf e dá switch no primeiro espaço que sobrou; se não sobrar nenhum, o getSelf volta
//  vazio e o caminho é criar um espaço — POST /Workspaces é a única rota da feature que não
//  confere matrícula, porque o workspace nasce nela.
//
//  'self' é segmento literal e o padrão de cima exige o prefixo literal 'IdWorkspaceMember=':
//  as duas rotas não se cruzam, em qualquer ordem de registro.
Workspaces_route.delete("/Workspaces/members/self", Workspaces_schema.leave, AsyncHandler(Workspaces_controller.leave))

//  O convite — a porta pela qual se entra num workspace alheio, agora que o cadastro não aceita
//  mais um IdWorkspace do corpo. Só o dono convida, lista e revoga (assertRole owner): um
//  editor que pudesse convidar promoveria terceiros ao próprio nível sem o dono saber.
Workspaces_route.post("/Workspaces/invite", Workspaces_schema.createInvite, AsyncHandler(Workspaces_controller.createInvite))

Workspaces_route.get("/Workspaces/invites", Workspaces_schema.getInvites, AsyncHandler(Workspaces_controller.getInvites))

//  Pública: quem recebeu o link ainda pode não ter conta, e exigir token aqui obrigaria a
//  cadastrar antes de saber para o que se está sendo convidado. Não devolve id nenhum.
Workspaces_route.get("/Workspaces/invite/Hash=:Hash", Workspaces_schema.getInviteByHash, AsyncHandler(Workspaces_controller.getInviteByHash, false))

//  Aceite de quem já tem conta. Não reemite o token: aceitar dá matrícula, não troca a sessão —
//  quem quiser operar no workspace novo chama o switch.
Workspaces_route.post("/Workspaces/join", Workspaces_schema.join, AsyncHandler(Workspaces_controller.join))

//  Revoga (Status = 'revoked'). É por causa desta rota que o convite é linha e não JWT: um
//  token de convite valeria até expirar, mesmo depois de o dono mudar de ideia.
Workspaces_route.delete("/Workspaces/invite/IdWorkspaceInvite=:IdWorkspaceInvite", Workspaces_schema.revokeInvite, AsyncHandler(Workspaces_controller.revokeInvite))

//  Sem IdWorkspace no caminho: edita o workspace selecionado na sessão.
Workspaces_route.put("/Workspaces", Workspaces_schema.update, AsyncHandler(Workspaces_controller.update))
