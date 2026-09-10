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
