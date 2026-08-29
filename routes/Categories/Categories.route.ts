import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Categories_controller } from "./Categories.controller"
import { Categories_schema } from "./Categories.schema"

export const Categories_route = express()

//  Categoria de gasto — entrada não tem categoria. Rotas escopadas por tenant como as de
//  Accounts: o IdWorkspace não aparece no caminho, vem do token da sessão, e toda section
//  começa por assertMember/assertRole usando o IdWorkspace que volta da matrícula.
//
//  O que é próprio desta feature: metade das linhas da tabela não é de ninguém. IdWorkspace
//  nulo é a pré-definida do sistema, visível a todos os workspaces e editável por nenhum —
//  ver sections/CategoryOwnership.section.ts.

//  As do workspace mais as globais, numa lista plana — não há categoria filha de outra.
Categories_route.get("/Base/Categories", Categories_schema.getByWorkspace, AsyncHandler(Categories_controller.getByWorkspace))

Categories_route.post("/Base/Categories", Categories_schema.create, AsyncHandler(Categories_controller.create))

Categories_route.put("/Base/Categories/IdCategory=:IdCategory", Categories_schema.update, AsyncHandler(Categories_controller.update))

//  Arquiva (Active = false). Ver sections/DELETE/remove.ts.
Categories_route.delete("/Base/Categories/IdCategory=:IdCategory", Categories_schema.remove, AsyncHandler(Categories_controller.remove))
