import express from "express"
import { Users_controller } from "./Users.controller"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Users_schema } from "./Users.schema"

export const Users_route = express()

//  Senha nunca vai na URL: o path inteiro cai no log de acesso do proxy, no histórico do
//  browser, no header Referer e no próprio Logs.handleError. Login e troca de senha vão no body.
Users_route.post("/Users/login", Users_schema.validateLogin, AsyncHandler(Users_controller.validateLogin, false))

//  Sem token de propósito (AsyncHandler(..., false)), como o login e o cadastro. Exigir sessão
//  aqui responderia 401 justo no caso em que o usuário mais quer sair — token expirado, cookie
//  meio apagado, aba velha — e o botão "Sair" travaria. Não há o que autorizar: o efeito da
//  rota é apagar um cookie do próprio chamador.
Users_route.post("/Users/logout", Users_schema.logout, AsyncHandler(Users_controller.logout, false))

//  As duas da recuperacao sao publicas por definicao: quem esqueceu a senha nao tem sessao.
//  A protecao nao e o token, e o link assinado que chega ao e-mail do dono da conta.
Users_route.post("/Users/forgotPassword", Users_schema.forgotPassword, AsyncHandler(Users_controller.forgotPassword, false))

Users_route.post("/Users/resetPassword", Users_schema.resetPassword, AsyncHandler(Users_controller.resetPassword, false))

//  As duas da confirmacao tambem sao publicas, e pelo mesmo motivo das de cima: quem nao
//  confirmou pode nao ter sessao nenhuma - o link chega no cadastro e e aberto em outro
//  aparelho, e o reenvio e pedido justamente por quem nao conseguiu entrar.
Users_route.post("/Users/confirmEmail", Users_schema.confirmEmail, AsyncHandler(Users_controller.confirmEmail, false))

Users_route.post("/Users/resendConfirmation", Users_schema.resendConfirmation, AsyncHandler(Users_controller.resendConfirmation, false))

Users_route.get("/Users/getSelf", Users_schema.getSelf, AsyncHandler(Users_controller.getSelf))

Users_route.post("/Users", Users_schema.create, AsyncHandler(Users_controller.create, false))

Users_route.put("/Users/IdUser=:IdUser", Users_schema.update, AsyncHandler(Users_controller.update))

Users_route.put("/Users/updatePassword", Users_schema.updatePassword, AsyncHandler(Users_controller.updatePassword))