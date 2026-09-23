import { KnexTransaction } from "root/Utils/Connections/Knex/KnexConnection"
import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

//  Grava a ordem das categorias do espaço.
//
//  **Recebe a lista COMPLETA de ids na ordem desejada, não "mova o id X para a posição N".**
//  São duas razões, e a segunda é a que decide:
//
//  - o cliente já tem a ordem inteira na mão — ele acabou de desenhá-la na tela;
//  - uma escrita parcial sobre `Position` obriga o servidor a renumerar o resto, e é aí que
//    dois usuários reordenando ao mesmo tempo produzem duas categorias na mesma posição. Com a
//    lista toda, a última escrita ganha INTEIRA: a ordem nunca fica meio aplicada.
//
//  A lista é a das **ativas**, e não a de todas as linhas do espaço. Posição é lugar na lista
//  de escolha, e perder esse lugar é precisamente o que arquivar quer dizer — obrigar o
//  cliente a mandar as arquivadas junto seria pedir uma ordem para quem não está em ordem
//  nenhuma. A linha que voltar ganha a sua posição no PUT que a desarquiva (ver ../PUT/update).
//
//  Por isso as três recusas abaixo, todas 406 e todas antes de qualquer escrita: **uma
//  reordenação que aceita lista incompleta é uma reordenação que deixa `Position` duplicada.**
export class Reorder {
    public async run(SelectedIdWorkspace: number, IdUser: number, body: CategoriesNamespace.ReorderCategoriesPayload) {
        //  Viewer lê a ordem, não a escreve — a mesma régua do POST e do PUT da feature.
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        let { IdCategories } = body

        //  O id repetido não é pego por nenhuma das duas conferências seguintes: com [1, 1, 2]
        //  sobre um espaço de [1, 2] não sobra id desconhecido nem id faltando, e a lista
        //  ainda assim descreve uma ordem impossível.
        if (new Set(IdCategories).size !== IdCategories.length) {
            throw new APIError({
                msg: "A lista de categorias tem o mesmo id mais de uma vez!",
                status: 406,
                data: { IdWorkspace, IdCategories },
            })
        }

        let current = await Categories_model.getByWorkspace(IdWorkspace)
        let currentIds = current.map((category) => category.IdCategory)

        //  Id de outro tenant, id que não existe e id de categoria arquivada caem todos aqui,
        //  com a mesma frase: a lista de ativas do espaço é a única que esta rota conhece.
        let unknown = IdCategories.filter((IdCategory) => !currentIds.includes(IdCategory))

        if (unknown.length > 0) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategories: unknown },
            })
        }

        //  E o outro lado: faltou id. Aceitar a lista curta seria numerar 1..N só o que veio e
        //  deixar o resto com a numeração velha — duas categorias na mesma posição, que é
        //  exatamente o estado que mandar a lista inteira existe para evitar.
        let missing = currentIds.filter((IdCategory) => !IdCategories.includes(IdCategory))

        if (missing.length > 0) {
            throw new APIError({
                msg: "A lista precisa trazer todas as categorias ativas do espaço!",
                status: 406,
                data: { IdWorkspace, IdCategories: missing },
            })
        }

        //  Transaction porque são N UPDATEs para UM estado: renumerar metade da lista e
        //  falhar no meio deixa o espaço com posições repetidas e nenhuma rota que conserte —
        //  a próxima reordenação partiria de uma ordem que o usuário não escolheu.
        await KnexTransaction(async (tx) => {
            for (let query of Categories_model.updatePositions(IdWorkspace, IdCategories)) {
                await query.transacting(tx)
            }
        })

        return { msg: "Ordem das categorias salva com sucesso" }
    }
}
