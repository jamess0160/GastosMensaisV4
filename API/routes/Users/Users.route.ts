import express from "express"
import { Users_controller } from "./Users.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Users_schema } from "./Users.schema"
import { RateLimits } from "./sections/RateLimits.section"

export const Users_route = express()

//  **O freio vem antes do schema em quatro rotas**, e a ordem é o ponto: o limitador é o
//  primeiro middleware da rota, então a requisição que estourou o teto é recusada com 429 sem
//  passar pelo Joi, pelo banco ou pelo bcrypt. Um freio depois da validação ainda deixaria o
//  atacante pagar o custo do servidor a cada tentativa.
//
//  Só as públicas: as autenticadas já têm o token como porta, e um teto por IP nelas contaria
//  o uso normal de quem está trabalhando. O porquê de cada janela está em `RateLimits.section`.

//  Senha nunca vai na URL: o path inteiro cai no log de acesso do proxy, no histórico do
//  browser, no header Referer e no próprio Logs.handleError. Login e troca de senha vão no body.
Users_route.post("/Users/login", RateLimits.login, Users_schema.validateLogin, AsyncHandler(Users_controller.validateLogin, false))

//  Sem token de propósito (AsyncHandler(..., false)), como o login e o cadastro. Exigir sessão
//  aqui responderia 401 justo no caso em que o usuário mais quer sair — token expirado, cookie
//  meio apagado, aba velha — e o botão "Sair" travaria. Não há o que autorizar: o efeito da
//  rota é apagar um cookie do próprio chamador.
Users_route.post("/Users/logout", Users_schema.logout, AsyncHandler(Users_controller.logout, false))

//  As duas da recuperacao sao publicas por definicao: quem esqueceu a senha nao tem sessao.
//  A protecao nao e o token, e o link assinado que chega ao e-mail do dono da conta.
Users_route.post("/Users/forgotPassword", RateLimits.forgotPassword, Users_schema.forgotPassword, AsyncHandler(Users_controller.forgotPassword, false))

Users_route.post("/Users/resetPassword", Users_schema.resetPassword, AsyncHandler(Users_controller.resetPassword, false))

//  As duas da confirmacao tambem sao publicas, e pelo mesmo motivo das de cima: quem nao
//  confirmou pode nao ter sessao nenhuma - o link chega no cadastro e e aberto em outro
//  aparelho, e o reenvio e pedido justamente por quem nao conseguiu entrar.
Users_route.post("/Users/confirmEmail", Users_schema.confirmEmail, AsyncHandler(Users_controller.confirmEmail, false))

Users_route.post("/Users/resendConfirmation", RateLimits.resendConfirmation, Users_schema.resendConfirmation, AsyncHandler(Users_controller.resendConfirmation, false))

Users_route.get("/Users/getSelf", Users_schema.getSelf, AsyncHandler(Users_controller.getSelf))

//  O re-aceite dos termos, para quem já tem conta. AUTENTICADA e sem corpo: quem aceita é o
//  dono do token, e com o que ele concorda é a constante da API. Vem logo abaixo do getSelf
//  porque é o par dele — o `TermsOutdated` de lá é a pergunta, esta rota é a resposta.
//
//  Sem freio de IP: o token já é a porta, e um teto aqui prenderia o escritório inteiro no dia
//  em que o documento mudasse.
Users_route.post("/Users/acceptTerms", Users_schema.acceptTerms, AsyncHandler(Users_controller.acceptTerms))

Users_route.post("/Users", RateLimits.create, Users_schema.create, AsyncHandler(Users_controller.create, false))

Users_route.put("/Users/IdUser=:IdUser", Users_schema.update, AsyncHandler(Users_controller.update))

Users_route.put("/Users/updatePassword", Users_schema.updatePassword, AsyncHandler(Users_controller.updatePassword))

//  Apagar a conta. Autenticada — é o token que diz de quem é a conta —, com a senha no corpo:
//  a sessão dura até 30 dias e a ação não se desfaz, então o cookie sozinho não basta.
//
//  DELETE com corpo, e não um POST /Users/delete: o verbo descreve o que acontece com o
//  recurso, e o corpo existe porque a senha não pode ir na URL.
Users_route.delete("/Users", Users_schema.remove, AsyncHandler(Users_controller.remove))
