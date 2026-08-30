import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { UsersAuth_controller } from "./UsersAuth.controller"
import { UsersAuth_schema } from "./UsersAuth.schema"

export const UsersAuth_route = express()

//  Biometria (WebAuthn/passkey). Dois fluxos de dois passos cada — pedir as options e devolver
//  a assinatura — costurados pelo ChallengeToken, que é o desafio assinado pela API.

//  Rotas públicas: são as do aparelho que ainda não tem token. O que elas expõem é sempre
//  ligado a um DeviceKey, que é um segredo de 32 bytes que só existe no próprio aparelho.
UsersAuth_route.get("/UsersAuth/checkDevice/DeviceKey=:DeviceKey", UsersAuth_schema.checkDevice, AsyncHandler(UsersAuth_controller.checkDevice, false))

UsersAuth_route.get("/UsersAuth/options/login/DeviceKey=:DeviceKey", UsersAuth_schema.getLoginOptions, AsyncHandler(UsersAuth_controller.getLoginOptions, false))

UsersAuth_route.post("/UsersAuth/authenticate", UsersAuth_schema.authenticate, AsyncHandler(UsersAuth_controller.authenticate, false))

//  Cadastrar e remover biometria exigem sessão: só quem já provou quem é por senha pode
//  mexer nas credenciais da própria conta.
UsersAuth_route.get("/UsersAuth/getSelf", UsersAuth_schema.getSelf, AsyncHandler(UsersAuth_controller.getSelf))

UsersAuth_route.get("/UsersAuth/options/register", UsersAuth_schema.getRegisterOptions, AsyncHandler(UsersAuth_controller.getRegisterOptions))

UsersAuth_route.post("/UsersAuth/register", UsersAuth_schema.register, AsyncHandler(UsersAuth_controller.register))

UsersAuth_route.post("/UsersAuth/skipDevice", UsersAuth_schema.skipDevice, AsyncHandler(UsersAuth_controller.skipDevice))

UsersAuth_route.delete("/UsersAuth/IdUserAuth=:IdUserAuth", UsersAuth_schema.remove, AsyncHandler(UsersAuth_controller.remove))
