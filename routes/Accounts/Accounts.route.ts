import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Accounts_controller } from "./Accounts.controller"
import { Accounts_schema } from "./Accounts.schema"

export const Accounts_route = express()

//  Primeira feature escopada por tenant: o IdWorkspace não aparece no caminho, vem do token
//  da sessão (POST /Base/Workspaces/switch o reemite, o acessMiddleware lê o cookie e põe em
//  res.locals).
//
//  Assinado, então o cliente não o forjou — mas pode estar velho: a matrícula pode ter sido
//  revogada, ou o papel rebaixado, depois de o token ser emitido. Toda section daqui começa
//  por assertMember/assertRole e usa o IdWorkspace que volta da matrícula, não o que entrou.

Accounts_route.get("/Base/Accounts", Accounts_schema.getByWorkspace, AsyncHandler(Accounts_controller.getByWorkspace))

Accounts_route.post("/Base/Accounts", Accounts_schema.create, AsyncHandler(Accounts_controller.create))

Accounts_route.put("/Base/Accounts/IdAccount=:IdAccount", Accounts_schema.update, AsyncHandler(Accounts_controller.update))

//  Arquiva (Active = false). Ver sections/DELETE/remove.ts: delete físico esbarraria no
//  ON DELETE RESTRICT de Inflows, e é para esbarrar mesmo.
Accounts_route.delete("/Base/Accounts/IdAccount=:IdAccount", Accounts_schema.remove, AsyncHandler(Accounts_controller.remove))
