import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Categories_controller } from "./Categories.controller"
import { Categories_schema } from "./Categories.schema"

export const Categories_route = express()

//  Categoria de gasto — entrada não tem categoria. Rotas escopadas por tenant como as de
//  Accounts: o IdWorkspace não aparece no caminho, vem do token da sessão, e toda section
//  começa por assertMember/assertRole usando o IdWorkspace que volta da matrícula.
//
//  **Toda linha da tabela é de um workspace.** Até a migration 20260922140000 as treze
//  pré-definidas eram globais (IdWorkspace nulo), visíveis a todos e editáveis por nenhum;
//  cada espaço ganhou a sua cópia, e com ela o direito de arquivar e reordenar. Quem semeia as
//  treze é a criação do workspace, com a lista do Categories.seed.ts.

//  As do workspace, numa lista plana — não há categoria filha de outra. `?IncludeArchived=true`
//  traz as arquivadas junto; sem ele, só as ativas, que é o que o seletor de gasto, o filtro e
//  o relatório precisam ver.
Categories_route.get("/Categories", Categories_schema.getByWorkspace, AsyncHandler(Categories_controller.getByWorkspace))

Categories_route.post("/Categories", Categories_schema.create, AsyncHandler(Categories_controller.create))

//  A ordem das categorias do espaço, pela lista COMPLETA de ids ativos. Declarada antes do PUT
//  com id por leitura, não por necessidade: o caminho do outro exige o literal "IdCategory=",
//  então "reorder" nunca casaria com ele. Ver sections/PUT/reorder.ts.
Categories_route.put("/Categories/reorder", Categories_schema.reorder, AsyncHandler(Categories_controller.reorder))

//  Edita, e é também o que DESARQUIVA: o corpo aceita Active. Ver sections/PUT/update.ts.
Categories_route.put("/Categories/IdCategory=:IdCategory", Categories_schema.update, AsyncHandler(Categories_controller.update))

//  Arquiva (Active = false). Ver sections/DELETE/remove.ts.
Categories_route.delete("/Categories/IdCategory=:IdCategory", Categories_schema.remove, AsyncHandler(Categories_controller.remove))
