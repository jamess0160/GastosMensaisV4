import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Persons_controller } from "./Persons.controller"
import { Persons_schema } from "./Persons.schema"

export const Persons_route = express()

//  Quem gastou. É a ponta de destino do rateio do gasto (ExpensePersons, com ON DELETE RESTRICT)
//  e do alvo de pessoa do orçamento, e as duas apontam para cá e nunca para Users — pessoa não
//  precisa de login. O rateio da RENDA apontava para cá também, até a leva 10 tirá-lo do produto
//  junto com a tabela (migration 20260923100000).
//
//  CRUD escopado por tenant como o resto: o IdWorkspace vem do token, toda section abre com
//  assertMember/assertRole e usa o IdWorkspace que volta da matrícula.
//
//  Não há rota que escreva o IdUser: o vínculo com um login nasce no cadastro do usuário
//  (sections/POST/createSelf.ts, dentro da transaction do signup). Ver POST/create.ts.

Persons_route.get("/Persons", Persons_schema.getByWorkspace, AsyncHandler(Persons_controller.getByWorkspace))

Persons_route.post("/Persons", Persons_schema.create, AsyncHandler(Persons_controller.create))

Persons_route.put("/Persons/IdPerson=:IdPerson", Persons_schema.update, AsyncHandler(Persons_controller.update))

//  Arquiva (Active = false), e recusa a pessoa vinculada a um login. Ver sections/DELETE/remove.ts.
Persons_route.delete("/Persons/IdPerson=:IdPerson", Persons_schema.remove, AsyncHandler(Persons_controller.remove))
