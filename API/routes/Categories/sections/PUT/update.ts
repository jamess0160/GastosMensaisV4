import { WorkspacesAcessControl } from "root/routes/Workspaces/sections/AcessControl.section"
import { APIError } from "root/Utils/Logs"
import { Categories_model } from "../../Categories.model"
import { CategoriesNamespace } from "../types"

//  Edita a categoria — e, desde a leva 9, **desarquiva**.
//
//  O `Active` entra aqui em vez de virar uma rota `restore` própria porque arquivar já é um
//  `UPDATE` de uma coluna: o DELETE grava `Active = false` e este PUT grava o que o corpo
//  mandar. Duas rotas para os dois sentidos da mesma coluna seriam dois lugares a manter em
//  acordo sobre quem pode escrevê-la.
export class Update {
    public async run(SelectedIdWorkspace: number, IdCategory: number, IdUser: number, body: CategoriesNamespace.UpdateCategoryPayload) {
        let { IdWorkspace } = await WorkspacesAcessControl.assertRole(SelectedIdWorkspace, IdUser, ["owner", "editor"])

        //  `true`: esta é a rota que desarquiva, então ela tem que ENXERGAR a arquivada. É o
        //  oposto do que ExpenseCategory pede da mesma consulta — lá a arquivada não existe
        //  mesmo, porque lançar gasto nela é o que arquivar impede.
        let category = await Categories_model.getUnique(IdWorkspace, IdCategory, true)

        //  Mesma resposta de "não é do seu workspace": um 404 diferenciado diria ao cliente
        //  quais IdCategory existem nos outros tenants.
        //
        //  E é a única resposta que sobrou. Enquanto existia a global (IdWorkspace nulo), o
        //  getUnique a encontrava e a escrita era recusada com um 406 próprio de "pré-definida
        //  do sistema". Acabaram as duas coisas: sem linha de ninguém, um id que não é deste
        //  espaço simplesmente não existe aqui — o mesmo tratamento de qualquer id alheio.
        if (!category) {
            throw new APIError({
                msg: "Categoria não encontrada!",
                status: 406,
                data: { IdWorkspace, IdCategory },
            })
        }

        //  **Desarquivar devolve a categoria ao FIM da lista, não ao lugar que ela ocupava.**
        //  A posição antiga já é de outra a essa altura — arquivar "Pets" e reordenar o resto
        //  deixa a posição 10 ocupada, e devolver o 10 para os dois faria "Pets" reaparecer no
        //  meio da lista, numa ordem que só o desempate por id decide. Escrever max + 1 é o
        //  que mantém `Position` sem empate sem precisar renumerar nada.
        //
        //  Só quando o corpo NÃO diz a posição: quem manda `Position` junto está dizendo onde
        //  quer a linha, e essa palavra é mais recente que esta regra.
        let restorePosition = body.Active === true && category.Active === false && body.Position === undefined

        let Position = restorePosition
            ? ((await Categories_model.maxActivePosition(IdWorkspace))?.Position ?? 0) + 1
            : undefined

        await Categories_model.update(IdCategory, Position === undefined ? body : { ...body, Position })

        return { msg: "Categoria atualizada com sucesso" }
    }
}
