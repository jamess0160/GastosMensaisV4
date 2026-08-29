import express from "express"
import { AsyncHandler } from "root/Utils/AsyncHandler"
import { Tags_controller } from "./Tags.controller"
import { Tags_schema } from "./Tags.schema"

export const Tags_route = express()

//  A taxonomia temporária (uma viagem, um evento), ao lado da permanente que é Categories: um
//  gasto tem uma categoria e N tags.
//
//  **Duas rotas só, e é de propósito.** A tag não tem cadastro próprio: ela nasce do texto que
//  o usuário digitou ao lançar o gasto (sections/POST/resolveByName.ts, chamado de dentro da
//  transaction do gasto). Não há POST porque cadastrar antes de usar seriam dois passos para
//  uma etiqueta, e não há PUT porque renomear mudaria a etiqueta de todos os gastos já
//  marcados — quem quer outro nome digita outro nome no próximo gasto.
//
//  O vínculo ExpenseTags também não tem rota: é montado junto com o gasto.

//  O input de sugestão, enquanto se digita: ?Search=via
Tags_route.get("/Base/Tags/search", Tags_schema.search, AsyncHandler(Tags_controller.search))

//  Arquiva (Active = false). Ver sections/DELETE/remove.ts: o delete físico levaria o vínculo
//  com os gastos junto, por causa do ON DELETE CASCADE de ExpenseTags.
Tags_route.delete("/Base/Tags/IdTag=:IdTag", Tags_schema.remove, AsyncHandler(Tags_controller.remove))
